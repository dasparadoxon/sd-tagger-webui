import os
import re


class DatasetImage:
    def __init__(self, path: str):
        self.path = path
        self.tagfile = get_tagfile(path)
        self.tags = []
        self.load()

    def save(self):
        write_tagfile(self.tagfile, self.tags)

    def load(self):
        self.tags = read_tagfile(self.tagfile)

    def __str__(self):
        return f"{self.path}-{self.tags}"


class Tagger:
    def __init__(self, path: str):
        if not os.path.isdir(path):
            raise NotADirectoryError("Invalid dataset path", path)
        self.index = 0
        self.path = path
        self.dataset, self.tags = load_dataset(path)
        self.num_files = len(self.dataset)

    # TODO Add/Remove Functions
    # def add(self):
    # def remove(self, index):

    def set(self, index: int):
        self.index = index
        if self.index < 0:
            self.index = self.num_files - 1
        if self.index >= self.num_files:
            self.index = 0

    def get(self, index: int):
        if self.num_files == 0:
            raise LookupError("Dataset is empty")
        if index < 0 or index >= self.num_files:
            raise IndexError("Got subscript", index, "which is out of bounds of 0 to", self.num_files - 1)
        return self.dataset[index]

    # Stepping Functions #
    def next(self):
        self.set(self.index + 1)

    def previous(self):
        self.set(self.index - 1)

    def current(self):
        return self.get(self.index)


# Helper Functions #
def load_dataset(path: str):
    files = recursive_dir(path, '.png')
    files = sort(files)
    dataset = []
    tags = set()
    for f in files:
        img_data = DatasetImage(f)
        # Catalogue all the dataset tags #
        for t in img_data.tags:
            tags.add(t)
        dataset.append(img_data)
    return dataset, tags


def get_tagfile(path: str):
    return os.path.splitext(path)[0] + '.txt'


def read_tagfile(tagfile: str):
    if os.path.isfile(tagfile):
        with open(tagfile, 'r') as f:
            return [t for t in f.read().strip().split(', ') if len(t) > 0]
    else:
        return []


def write_tagfile(tagfile: str, tags: list):
    with open(tagfile, 'w') as f:
        f.write(', '.join(tags))


# Sort Alphanumerically
def sort(l: list):
    convert = lambda text: int(text) if text.isdigit() else text
    alphanum_key = lambda key: [convert(c) for c in re.split('([0-9]+)', key)]
    return sorted(l, key=alphanum_key)


def recursive_dir(path: str, ext: str):
    r = []
    for f in os.listdir(path):
        jf = os.path.join(path, f)
        if os.path.isdir(jf):
            r += recursive_dir(jf, ext)
        elif os.path.isfile(jf):
            if jf.lower().endswith(ext):
                r.append(jf)
    return r

