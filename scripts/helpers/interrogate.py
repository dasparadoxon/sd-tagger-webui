import torch
import numpy as np
from modules import devices, shared
from modules import deepbooru as db
from modules import images as imgtool

class DeepDanbooru():
    def start(self):
        db.model.start()

    def stop(self):
        db.model.stop()

    def predict(self, pil_image, threshold):

        pic = imgtool.resize_image(2, pil_image.convert("RGB"), 512, 512)
        a = np.expand_dims(np.array(pic, dtype=np.float32), 0) / 255

        with torch.no_grad(), devices.autocast():
            x = torch.from_numpy(a).to(devices.device)
            y = db.model.model(x)[0].detach().cpu().numpy()

        probability_dict = {}

        for tag, probability in zip(db.model.model.tags, y):
            if threshold and probability < threshold:
                continue
            if tag.startswith("rating:"):
                continue
            probability_dict[tag.replace("_", " ")] = probability

        return probability_dict