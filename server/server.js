var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var _ = require('underscore');
var readline = require('readline')
var fs = require('fs')
const {spawn} = require('child_process');
var bodyParser = require('body-parser');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

if (process.argv.length == 2) {
  var command_process = spawn("python3", ['./send_command.py'])
  var command_switch = spawn("python3", ['./switch_read.py'])
  var command_midiread = spawn("python3", ['./midi_recv.py'])

  command_process.stderr.on('data', (data) => {
    console.log("Error from send_command: " + data)
  });

  command_switch.stdout.on('data', (data) => {
    data = parseInt(data.toString(), 10)
    send_command({type: 'program_change', program: data})
  });

  readline.createInterface({
    input: command_midiread.stdout
  }).on('line', (data) => {
    data = JSON.parse(data)
    on_midi(data)
  });
} else {
  console.log("Error: Couldn't start python processes")
}

function send_command(data) {
  data = JSON.stringify(data);
  if (!command_process) {
    console.log("Warning: not sending MIDI command: ",data);
    return;
  }
  console.log("Writing to midi: " + data)
  command_process.stdin.write(data + "\n")
}

server.listen(8080);

app.get('/', function(req, res) {
  console.log("GOT slash")
  res.send("OK")
});

app.post("/patch/:id", function(req, res) {
  console.log("PATCH " + req.params['id']);
  patch = spawn("python3", ["./send_patch.py", req.params['id']]);
  patch.on('close', () => {
    console.log("Patch finished")
  });
  res.send("OK")
});

app.post("/command", function(req, res) {
  console.log(req.body)
  var data = req.body
  if (data['program']) {
    data['program'] = parseInt(data['program'])
  }
  //(['program']).forEach((key) => {
  //    console.log(key)
  //    if(data[key]) {
  //      data[key] = parseInt(data[key])
  //    }
  //  });
  console.log("Command: " + JSON.stringify(data))
  send_command(data)
});

var state = {
  hello: "world",
  amp: 'XXX',
  amptype: 'Clean'
}

var presets = {

}

state = JSON.parse(fs.readFileSync("state.json"))
presets = JSON.parse(fs.readFileSync("presets.json"))

var save = _.throttle(function() {
  fs.writeFileSync("state.json",JSON.stringify(state,null,'  '));
},1000)

const known_controls = {"Delay Level": {"control": 23, "config_index": null}, "P1": {"control": 27, "config_index": null}, "High": {"control": 19, "config_index": null}, "Delay Feedback": {"control": 21, "config_index": null}, "amptype": {"control": 12, "config_index": null}, "Amp": {"control": 8, "config_index": null}, "SB_P2": {"control": 24, "config_index": null}, "Pre-Gain": {"control": 16, "config_index": null}, "SB_P1": {"control": 25, "config_index": null}, "Post-Gain": {"control": 20, "config_index": null}, "P2": {"control": 26, "config_index": null}, "Reverb": {"control": 31, "config_index": null}, "Mid": {"control": 18, "config_index": null}, "Low": {"control": 17, "config_index": null}, "Effect": {"control": 10, "config_index": null}, "stompbox": {"control": 11, "config_index": null}}

var id_to_name = {}
for(key in known_controls) {
  id_to_name[known_controls[key].control] = key
}

function refresh_state_from_amp() {
  console.log("Sending refresh command to amp")
  const prefix = [ 0x00, 0x00, 0x1B, 0x12, 0x00];
  send_command({type: 'sysex', data: prefix.concat([0x63,0x7f,0x7f]) })
}

function parse_sysex(data) {
  //console.log("SYSEX: ", JSON.stringify(data))
  for(key in known_controls) {
    var control = known_controls[key]
    if(!control.config_index) {
      continue
    }
    var value = 
      data.data[control.config_index-0] +
      data.data[control.config_index-1] * 16;
    //console.log("Key: ",key," = ",value)
     // console.log([
//      (data.data[control.config_index-0] << 0),
//      (data.data[control.config_index-1] << 0)
//      ])
    if(state[key] != value) {
      setState(key,value)
    }
  }
}

function setState(key,value) {
  state[key] = value;
  var toemit = {
    key: key,
    value: value
  }
  io.emit('set',toemit)
  save();
}

function on_midi(data) {
  if(data.type === 'sysex') {
    return parse_sysex(data);
  }
  if(data.type !== 'control_change') {
    console.log("Unknown midi stream: " + JSON.stringify(data))
    return
  }
  // XXXX
  console.log(data)
  var key = id_to_name[data.control]
  if(!key) {
    console.log("Warning: from midi unknown control changed: " + JSON.stringify(data))
    return;
  }
  console.log("Setting from midi: " + key);
  setState(key,data.value)
  checkSideEffect(key);
}

function checkSideEffect(key) {
  const side_effect_controls = ['amptype','Effect','Amp']
  if(side_effect_controls.includes(key)) {
    refresh_state_from_amp()
  }
}

io.on('connection', function(socket) {
  console.log("Connection");
  socket.emit('state', state);
  socket.on('set', (values) => {
    console.log(values)

    state[values.key] = values.value;

    var control = known_controls[values.key]
    if(control) {
      var value;
      if(values.midi) {
        value = values.midi
      } else {
	value = parseInt(values.value)
      }

      send_command({
        type: 'control_change',
	control: control.control,
	value: value
      })
    }
    checkSideEffect(values.key)

    //if(values.midi) {
     // send_command(values.midi);
    //}
    socket.broadcast.emit('set', values);
    save();
  });
});

refresh_state_from_amp()
console.log("READY")
