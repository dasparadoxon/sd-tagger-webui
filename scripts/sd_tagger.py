import os
import gradio as gr
from scripts.helpers.tagger import Tagger
from modules import script_callbacks, sd_models

tagger = None

with open('extensions/sd-tagger-webui/tag_list.html', 'r') as f:
    html_string = f.read()

def on_ui_tabs():
	with gr.Blocks(analytics_enabled=False) as sd_tagger:
		log_row = gr.Row(variant="panel", visible=False)
		with log_row:
			log_output = gr.HTML(value="")
		with gr.Row():
			dataset_textbox = gr.Text(value="", label="Path to Dataset")
			process_button = gr.Button(value="Process", variant="primary")
		with gr.Row():
			with gr.Column(variant="panel"):
				display_tags = gr.TextArea(elem_id="display_tags", value="", interactive=True)
				with gr.Row(variant="panel"):
					with gr.Column():
						gr.HTML(elem_id="tag_list", value=html_string)
				with gr.Row(variant="panel"):
					tags_textbox = gr.Text(value="", label="Path to Tags")
					load_tags_button = gr.Button(value="Load Tags", variant="secondary")
			with gr.Column():
				display = gr.Image(interactive=False, elem_id="tagging_image", show_label=True)
				with gr.Row():
					log_count = gr.HTML(value="")
					display_index = gr.Slider(visible=False)
				with gr.Row():
					previous_button = gr.Button(value="Previous", variant="secondary")
					next_button = gr.Button(value="Next", variant="secondary")

		# Section used to transfer data between js and gradio
		tags_data = gr.Text(elem_id="tags_data", visible=False)
		save_tags_button = gr.Button(elem_id="save_tags", visible=False)

		def save_tags_click(text):
			tagger.current().tags = [x.strip() for x in text.split(',')]
			tagger.current().save()
			print("Saved ", tagger.index, "::", tagger.current().tagfile, tagger.current().tags)

		def load_tags_click(path):
			if not os.path.isfile(path):
				return gr.update(visible=True), f"Error: Invalid Tags Path", None
			with open(path, 'r') as f:
				tags = list(dict.fromkeys([line.rstrip() for line in f]))
			return gr.update(visible=True), f"Successfully imported {len(tags)} tags from {path}", tags

		def process_click(path):
			if not os.path.isdir(path):
				return gr.update(visible=True), f"Error: Invalid Dataset Path", None
			global tagger
			tagger = Tagger(path)
			return gr.update(visible=True), f"Successfully got {tagger.num_files} images from {path}", tagger.current().path

		def previous_click():
			tagger.previous()
			return gr.update(value=tagger.index)

		def next_click():
			tagger.next()
			return gr.update(value=tagger.index)

		def display_update():
			return ", ".join(tagger.current().tags), f"{tagger.index} / {tagger.num_files}", gr.update(value=tagger.index, maximum=tagger.num_files, visible=True, interactive=True)
		
		def index_update(index):
			tagger.set(index)
			return tagger.current().path

		save_tags_button.click(fn=save_tags_click, inputs=[display_tags])

		load_tags_button.click(fn=load_tags_click, inputs=[tags_textbox], outputs=[log_row, log_output, tags_data])

		process_button.click(fn=process_click, inputs=[dataset_textbox], outputs=[log_row, log_output, display])
		previous_button.click(fn=previous_click, outputs=[display_index])
		next_button.click(fn=next_click, outputs=[display_index])
		display.change(fn=display_update, outputs=[display_tags, log_count, display_index])
		display_index.change(fn=index_update, inputs=[display_index], outputs=[display])

	return (sd_tagger, "SD Tagger", "sd_tagger"),

def on_ui_settings():
	print("No settings")

script_callbacks.on_ui_settings(on_ui_settings)
script_callbacks.on_ui_tabs(on_ui_tabs)