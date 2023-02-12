import os
import json
import gradio as gr
import base64
import random
import tempfile
import shutil
import re
from PIL import Image
from scripts.helpers.tagger import Tagger, load_dataset_tags, sort_alphanumeric
from scripts.helpers.interrogate import DeepDanbooru
from modules import script_callbacks, sd_models
from modules.shared import opts, OptionInfo


deep = DeepDanbooru()

# Globals
tagger = None
dataset_tags = None
config = {
    "dataset_path": "",
    "tags_path": ""
}

config_file = "extensions/sd-tagger-webui/config.json"

# TODO Improve
tags_list_file = "extensions/sd-tagger-webui/html/tags_list.html"
display_file = "extensions/sd-tagger-webui/html/display.html"
display_tags_file = "extensions/sd-tagger-webui/html/display_tags.html"

# Import HTML
with open(tags_list_file, "r") as f:
    tags_list_html = f.read()
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
                        gr.HTML(value=tags_list_html)
                with gr.Row(variant="panel"):
                    tags_radio = gr.Radio(value="", choices=["Dataset Tags", "File"], label="Tag Set", interactive=True)
                with gr.Row(variant="panel"):
                    tags_textbox = gr.Text(value=config["tags_path"], label="Path to Tags")
                    load_tags_button = gr.Button(value="Load Tags", variant="secondary")
                with gr.Row(variant="panel"):
                    interrogate_button = gr.Button(elem_id="interrogate_button", value="Interrogate", variant="secondary")
                    interrogate_append_method = gr.Radio(value="Replace", choices=["Replace", "Before", "After"], label="Append Options", interactive=True)
                    interrogate_threshold = gr.Slider(value=0.6, minimum=0.0, maximum=1.0, label="Threshold", interactive=True)
                with gr.Row():
                    interrogate_off_button = gr.Button(value="Interrogate Off", variant="secondary", visible=False)
            # Right Side
            with gr.Column():
                gr.HTML(elem_id="display_html", value=display_html)
                display = gr.Image(interactive=False, show_label=False, elem_id="display_image_to_move", type="pil")
                with gr.Row():
                    with gr.Row(variant="panel"):
                        display_log = gr.HTML(elem_id="display_log", value="")
                    display_index = gr.Slider(label="Dataset Index", interactive=True)
                with gr.Row():
                    previous_button = gr.Button(value="Previous", variant="secondary")
                    next_button = gr.Button(value="Next", variant="secondary")
                with gr.Row():
                    save_tags_button = gr.Button(value="Save Tags", elem_id="save_tags")

        # Hidden Elements #

        # The tags that the user is currently editing.
        draft_tags = gr.Text(elem_id="draft_tags", visible=False)

        # Tags that are loaded by using existing dataset tags or loading them by file.
        available_tags = gr.Text(elem_id="available_tags", visible=False)

        crop_data = gr.Text(elem_id="crop_data", visible=False)
        crop_button = gr.Button(elem_id="crop_button", visible=False)
        reload_tags_list_button = gr.Button(elem_id="reload_tags_list_button", visible=False);

        # Component actions
        def save_tags_click(text):
            if tagger:
                if text:
                    tagger.current().tags = [x.strip() for x in text.split(',')]
                else:
                    tagger.current().tags = []
                tagger.current().save()
                if bool(opts.print_save_tags):
                    print("Saved ", tagger.index, "::", tagger.current().tagfile, tagger.current().tags)

        def load_tags_click(path):
            if not os.path.isfile(path):
                return gr.update(visible=True), f"Error: Invalid Tags Path", None
            with open(path, 'r') as f:
                list_tags = list(dict.fromkeys([line.rstrip() for line in f]))
                tags = ",".join(list_tags)
                global dataset_tags
                dataset_tags = list_tags
            config["tags_path"] = path
            save_config()
            return gr.update(visible=True), f"Successfully imported {len(list_tags)} tags from {path}", tags

        def process_click(path, tags_radio, loaded_tags):
            if not os.path.isdir(path):
                return gr.update(visible=True), f"Error: Invalid Dataset Path", None
            global tagger
            tagger = Tagger(path)
            config["dataset_path"] = path
            save_config()

            if tags_radio == "Dataset Tags":
                return gr.update(visible=True), f"Successfully got {tagger.num_files} images from {path}", tagger.current().path, 1, reload_tags_list_click(), ", ".join(tagger.current().tags)
            else:
                return gr.update(visible=True), f"Successfully got {tagger.num_files} images from {path}", tagger.current().path, 1, loaded_tags, ", ".join(tagger.current().tags)

        def previous_click(index):
            return gr.update(value=index - 1)

        def next_click(index):
            return gr.update(value=index + 1)

        def display_update(image):
            w, h = image.size
            return ", ".join(tagger.current().tags), f"{tagger.index + 1} / {tagger.num_files} {tagger.current().path} ({w}x{h})", gr.update(value=tagger.index + 1, minimum=1, maximum=tagger.num_files)

        def index_update(image_tags, index):
            if bool(opts.display_change_save_tags):
                save_tags_click(image_tags)
            tagger.set_index(index - 1)
            return tagger.current().path

        def crop_click(image, crop_json, image_tags):
            if not os.path.isdir("extensions/sd-tagger-webui/crops"):
                os.mkdir("extensions/sd-tagger-webui/crops")
            rect = json.loads(crop_json)
            rect = (rect["x1"], rect["y1"], rect["x2"], rect["y2"])
            try:
                crop_image = image.crop(rect)
                w, h = crop_image.size
                crop_name = str(tagger.index) + "-(" + str(w) + "x" + str(h) + ")-" + str(random.randint(0, 100000))
                crop_image.save("extensions/sd-tagger-webui/crops/" + crop_name + ".png")
                if bool(opts.cropper_copy_tags):
                    if image_tags:
                        with open("extensions/sd-tagger-webui/crops/" + crop_name + ".txt", 'w') as f:
                            f.write(image_tags)
                    print("Cropped", tagger.index, crop_json, "Saved To:", crop_name + ".png", "+ Tags")
                else:
                    print("Cropped", tagger.index, crop_json, "Saved To:", crop_name + ".png")
            except Exception as err:
                print("Error while cropping: ", err)

        def interrogate_off_click():
            deep.stop()
            print("Stopped Interrogator.")
            return gr.update(visible=False)

        def interrogate_click(image, image_tags, append_method, threshold):
            if image is None:
                print("Interrogate failed. No images loaded.")
                return image_tags
            if not deep.on:
                print("Starting Interrogator...")
                deep.start()

            predict_tags = deep.predict(image, threshold).keys()
            if bool(opts.print_interrogate):
                print("Threshold:", threshold, "Got:", len(predict_tags), "Tags")
            predict_tags = ", ".join(predict_tags)

            if len(image_tags) == 0:
                return predict_tags, gr.update(visible=True)

            if append_method == "Replace":
                return predict_tags, gr.update(visible=True)
            elif append_method == "Before":
                return predict_tags + ", " + image_tags, gr.update(visible=True)
            elif append_method == "After":
                return image_tags + ", " + predict_tags, gr.update(visible=True)

        def tags_radio_update(value, loaded_tags):
            if value == "Dataset Tags":
                if tagger:
                    return reload_tags_list_click(), gr.update(visible=False), gr.update(visible=False)
            elif value == "File":
                return loaded_tags, gr.update(visible=True), gr.update(visible=True)

        def reload_tags_list_click(dataset_type="Dataset Tags", path=None):
            return ",".join(reload_available_tags(dataset_type, path))

        def reload_available_tags(dataset_type="Dataset Tags", path=None):
            global dataset_tags
            if dataset_type == "Dataset Tags":
                dataset_tags = load_dataset_tags(tagger.dataset)
                if opts.tag_sort == "Alphanumeric":
                    dataset_tags = sort_alphanumeric(dataset_tags.keys())
                elif opts.tag_sort == "Rank":
                    dataset_tags = reversed(sorted(dataset_tags, key=lambda i: int(dataset_tags[i])))
            elif dataset_type == "File":
                load_tags_click(path)
            return dataset_tags

        # Events
        crop_button.click(fn=crop_click, inputs=[display, crop_data, draft_tags])
        interrogate_off_button.click(fn=interrogate_off_click, outputs=[interrogate_off_button])
        interrogate_button.click(fn=interrogate_click, inputs=[display, draft_tags, interrogate_append_method, interrogate_threshold], outputs=[draft_tags, interrogate_off_button])
        save_tags_button.click(fn=save_tags_click, inputs=[draft_tags])
        load_tags_button.click(fn=load_tags_click, inputs=[tags_textbox], outputs=[log_row, log_output, available_tags])
        process_button.click(fn=process_click, inputs=[dataset_textbox, tags_radio, available_tags], outputs=[log_row, log_output, display, display_index, available_tags, draft_tags])
        previous_button.click(fn=previous_click, inputs=[display_index], outputs=[display_index])
        next_button.click(fn=next_click, inputs=[display_index], outputs=[display_index])
        display.change(fn=display_update, inputs=[display], outputs=[draft_tags, display_log, display_index])
        display_index.change(fn=index_update, inputs=[draft_tags, display_index], outputs=[display])
        tags_radio.change(fn=tags_radio_update, inputs=[tags_radio, available_tags], outputs=[available_tags, load_tags_button, tags_textbox])
        reload_tags_list_button.click(fn=reload_tags_list_click, inputs=[tags_radio, tags_textbox], outputs=[available_tags])

    return (sd_tagger, "SD Tagger", "sd_tagger"),


def on_ui_settings():
    section = ('sd-tagger', "SD Tagger")
    opts.add_option("max_tag_count", OptionInfo(75, "Maximum number of tags to display", section=section))
    opts.add_option("tag_sort", OptionInfo("Rank", "Tag Sorting (Dataset Tags)", gr.Radio, {"choices": ["Alphanumeric", "Rank"]}, section=section))
    opts.add_option("cropper_snap", OptionInfo(64, "Cropper Grid Snap", gr.Slider, {"minimum": 2, "maximum": 128, "step": 2}, section=section))
    opts.add_option("cropper_copy_tags", OptionInfo(True, "Clone tags from the source image to cropped image", section=section))
    opts.add_option("display_change_save_tags", OptionInfo(True, "Automatically save tags on scroll", section=section))
    opts.add_option("auto_interrogate", OptionInfo(False, "Automatically interrogate on scroll", section=section))
    opts.add_option("print_save_tags", OptionInfo(False, "Log when tags are saved", section=section))
    opts.add_option("print_interrogate", OptionInfo(False, "Log when interrogating", section=section))
    opts.add_option("highlight_duplicate", OptionInfo(True, "Highlight duplicate tags", section=section))
    opts.add_option("open_tag_wiki", OptionInfo(False, "Middle-click on tag to view wiki", section=section))
    #opts.add_option("cropper_mode", OptionInfo("Drag", "Cropper Mode", gr.Radio, {"choices": ["Drag", "Brush"]}, section=

script_callbacks.on_ui_settings(on_ui_settings)
script_callbacks.on_ui_tabs(on_ui_tabs)
