import os
import sys
import re
import numpy

class DatasetImage:
	def __init__(self, path):
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
	def __init__(self, path):
		self.index = 0
		self.path = path
		self.dataset = self.loadDataset(path)
		self.num_files = len(self.dataset)
	
	def set(self, index):
		self.index = index
		if self.index >= self.num_files:
			self.index = 0
		if self.index < 0:
			self.index = self.num_files - 1

	def next(self):
		self.set(self.index + 1)

	def previous(self):
		self.set(self.index - 1)

	def current(self):
		return self.dataset[self.index]

	def loadDataset(self, path):
		files = recursive_dir(path, '.png')
		files = sort(files)
		dataset = []
		for f in files:
			dataset.append(DatasetImage(f))
		return dataset

## Helper Functions ##
def get_tagfile(path):
	return os.path.splitext(path)[0] + '.txt'

def read_tagfile(tagfile):
	if os.path.isfile(tagfile):
		with open(tagfile, 'r') as f:
			return [t for t in f.read().strip().split(', ') if len(t) > 0]

def write_tagfile(tagfile, tags):
	with open(tagfile, 'w') as f:
		f.write(', '.join(tags))

def sort(l): 
	convert = lambda text: int(text) if text.isdigit() else text 
	alphanum_key = lambda key: [ convert(c) for c in re.split('([0-9]+)', key) ] 
	return sorted(l, key = alphanum_key)

def recursive_dir(path, ext):
	r = []
	for f in os.listdir(path):
		jf = os.path.join(path, f)
		if os.path.isdir(jf):
			r += recursive_dir(jf, ext)
		elif os.path.isfile(jf):
			if jf.lower().endswith(ext):
				r.append(jf)
	return r