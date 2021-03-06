import mido
import sys
import time
import json

midi_name = None
for name in mido.get_output_names():
  if name.startswith("VYPYR"):
    midi_name = name

if not midi_name:
  print("Could not find VYPYR interface")
  sys.exit(1)

output = mido.open_output(midi_name)

while True:
  line = sys.stdin.readline()
  data = json.loads(line)
  # Why python is doing this for parsing json, I can't say
  if 'value' in data and data['value'] == None:
    data['value'] = 0
  msg = mido.Message(**data)
  output.send(msg)
