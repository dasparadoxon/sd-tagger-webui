import os
import json
import gradio as gr
import base64
import random
from PIL import Image
from scripts.helpers.tagger import Tagger
from scripts.helpers.interrogate import DeepDanbooru
from modules import script_callbacks, sd_models
from modules.shared import opts, OptionInfo


deep = DeepDanbooru()
deep.start()

# Globals
tagger = None
config = {
    "dataset_path": "",
    "tags_path": ""
}

config_file = "extensions/sd-tagger-webui/config.json"

# TODO Improve
tag_list_file = "extensions/sd-tagger-webui/html/tag_list.html"
display_file = "extensions/sd-tagger-webui/html/display.html"
display_tags_file = "extensions/sd-tagger-webui/html/display_tags.html"

# Import HTML
with open(tag_list_file, "r") as f:
    tag_list_html = f.read()
with open(display_file, "r") as f:
    display_html = f.read()
with open(display_tags_file, "r") as f:
    display_tags_html = f.read()

# TODO Switch to options?
# Import Config
if os.path.isfile(config_file):
    with open(config_file, "r") as f:
        config = json.load(f)


def save_config():
    with open(config_file, "w") as f:
        json.dump(config, f)


def on_ui_tabs():
    with gr.Blocks(analytics_enabled=False) as sd_tagger:

        # Main interface
        log_row = gr.Row(variant="panel", visible=False)
        with log_row:
            log_output = gr.HTML(value="")
        with gr.Row():
            dataset_textbox = gr.Text(value=config["dataset_path"], label="Path to Dataset")
            process_button = gr.Button(value="Process", variant="primary")
        with gr.Row():
            # Left Side
            with gr.Column(variant="panel"):
                gr.HTML(value=display_tags_html)
                with gr.Row(variant="panel"):
                    with gr.Column():
                        gr.HTML(elem_id="tag_list", value=tag_list_html)
                with gr.Row(variant="panel"):
                    tags_textbox = gr.Text(value=config["tags_path"], label="Path to Tags")
                    load_tags_button = gr.Button(value="Load Tags", variant="secondary")
                with gr.Row(variant="panel"):
                    interrogate_button = gr.Button(value="Interrogate", variant="secondary")
                    interrogate_append_method = gr.Radio(value="Replace", choices=["Replace", "Prepend", "Append"], label="Append Options", interactive=True)
                    interrogate_threshold = gr.Slider(value=0.6, minimum=0.0, maximum=1.0, label="Threshold", interactive=True)
            # Right Side
            with gr.Column():
                gr.HTML(elem_id="display_html", value=display_html)
                display = gr.Image(interactive=False, show_label=False, elem_id="tagging_image", type="pil")
                with gr.Row():
                    log_count = gr.HTML(value="")
                    display_index = gr.Slider(visible=False)
                with gr.Row():
                    previous_button = gr.Button(value="Previous", variant="secondary")
                    next_button = gr.Button(value="Next", variant="secondary")

        # Section used to transfer data between js and gradio
        display_tags = gr.Text(elem_id="display_tags_internal", visible=False)
        tags_data = gr.Text(elem_id="tags_data", visible=False)
        save_tags_button = gr.Button(elem_id="save_tags", visible=False)
        crop_data = gr.Text(elem_id="crop_data", visible=False)
        crop_button = gr.Button(elem_id="crop_button", visible=False)

        # Component actions
        def save_tags_click(text):
            if tagger:
                if bool(opts.display_change_save_tags):
                    tagger.current().tags = [x.strip() for x in text.split(',')]
                    tagger.current().save()
                    #print("Saved ", tagger.index, "::", tagger.current().tagfile, tagger.current().tags)

        def load_tags_click(path):
            if not os.path.isfile(path):
                return gr.update(visible=True), f"Error: Invalid Tags Path", None
            with open(path, 'r') as f:
                tags = list(dict.fromkeys([line.rstrip() for line in f]))
            config["tags_path"] = path
            save_config()
            return gr.update(visible=True), f"Successfully imported {len(tags)} tags from {path}", tags

        def process_click(path):
            if not os.path.isdir(path):
                return gr.update(visible=True), f"Error: Invalid Dataset Path", None
            global tagger
            tagger = Tagger(path)
            config["dataset_path"] = path
            save_config()
            return gr.update(visible=True), f"Successfully got {tagger.num_files} images from {path}", tagger.current().path

        def previous_click():
            return gr.update(value=tagger.index - 1)

        def next_click():
            return gr.update(value=tagger.index + 1)

        def display_update():
            return ", ".join(tagger.current().tags), f"{tagger.index} / {tagger.num_files}", gr.update(value=tagger.index, maximum=tagger.num_files, visible=True, interactive=True)

        def index_update(image_tags, index):
            save_tags_click(image_tags)
            tagger.set(index)
            return tagger.current().path

        def crop_click(image, crop_json):
            if not os.path.isdir("extensions/sd-tagger-webui/crops"):
                os.mkdir("extensions/sd-tagger-webui/crops")
            rect = json.loads(crop_json)
            rect = (rect["x1"], rect["y1"], rect["x2"], rect["y2"])
            try:
                crop_image = Image.fromarray(image).crop(rect)
                w, h = crop_image.size
                crop_name = str(tagger.index) + "-(" + str(w) + "x" + str(h) + ")-" + str(random.randint(0, 100000)) + ".png"
                crop_image.save("extensions/sd-tagger-webui/crops/" + crop_name)
                print("Cropped", tagger.index, crop_json, "Saved To:", crop_name)
            except Exception as err:
                print("Error while cropping: ", err)

        def interrogate_click(image, image_tags, append_method, threshold):
            predict_tags = deep.predict(image, threshold).keys()
            print("Threshold:", threshold, "Got:", len(predict_tags), "Tags")
            predict_tags = ", ".join(predict_tags)

            if len(image_tags) == 0:
                return predict_tags

            if append_method == "Replace":
                return predict_tags
            elif append_method == "Prepend":
                return predict_tags + ", " + image_tags
            elif append_method == "Append":
                return image_tags + ", " + predict_tags

        # Events
        crop_button.click(fn=crop_click, inputs=[display, crop_data])
        interrogate_button.click(fn=interrogate_click, inputs=[display, display_tags, interrogate_append_method, interrogate_threshold], outputs=[display_tags])
        save_tags_button.click(fn=save_tags_click, inputs=[display_tags])
        load_tags_button.click(fn=load_tags_click, inputs=[tags_textbox], outputs=[log_row, log_output, tags_data])
        process_button.click(fn=process_click, inputs=[dataset_textbox], outputs=[log_row, log_output, display])
        previous_button.click(fn=previous_click, outputs=[display_index])
        next_button.click(fn=next_click, outputs=[display_index])
        display.change(fn=display_update, outputs=[display_tags, log_count, display_index])
        display_index.change(fn=index_update, inputs=[display_tags, display_index], outputs=[display])

    return (sd_tagger, "SD Tagger", "sd_tagger"),


def on_ui_settings():
    section = ('sd-tagger', "SD Tagger")
    opts.add_option("cropper_snap", OptionInfo(64, "Cropper Snap (Drag)", gr.Slider, {"minimum": 2, "maximum": 128, "step": 2}, section=section))
    opts.add_option("display_change_save_tags", OptionInfo(True, "Save Tags on Scroll", section=section))
    #opts.add_option("cropper_mode", OptionInfo("Drag", "Cropper Mode", gr.Radio, {"choices": ["Drag", "Brush"]}, section=section))

script_callbacks.on_ui_settings(on_ui_settings)
script_callbacks.on_ui_tabs(on_ui_tabs)
