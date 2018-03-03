import mido
import sys
import time
import sys

midi_name = None
for name in mido.get_output_names():
  if name.startswith("VYPYR"):
    midi_name = name

if not midi_name:
  print("Could not find VYPYR interface")
  sys.exit(1)

output = mido.open_output(midi_name)

def send_value(control,value):
    msg = mido.Message("control_change", control=control, value=value)
    output.send(msg)

while True:
  send_value(int(sys.argv[1]),0x1)
  time.sleep(1)
  send_value(int(sys.argv[1]),0x2)
  time.sleep(1)
