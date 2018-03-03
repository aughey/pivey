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
  console.log("Writing: " + data)
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

const known_controls = {
    "Pre-Gain" : 16,
    "Low": 17,
    "Mid" : 18,
    "High" : 19,
    "Post-Gain" : 20,
    "P1" : 27,
    "P2" : 26,
    "Delay Feedback" : 21,
    "Delay Level" : 23,
    "Reverb" : 31,
    "Effect" : 10,
    "Amp" : 8,
    "Inst/Stomp" : 11
}
var id_to_name = {}
for(key in known_controls) {
  id_to_name[known_controls[key]] = key
}

function on_midi(data) {
  if(data.type !== 'control_change') {
    return
  }
  console.log(data)
  var key = id_to_name[data.control]
  if(!key) {
    console.log("Warning: known control changed: " + JSON.stringify(data))
    console.log(id_to_name)
    return;
  }
  console.log("Setting: " + key);
  state[key] = data.value / 127 * 10.0
  var toemit = {
    key: key,
    value: state[key]
  }
  io.emit('set',toemit)
}

io.on('connection', function(socket) {
  console.log("Connection");
  socket.emit('state', state);
  socket.on('set', (values) => {
    console.log(values)

    state[values.key] = values.value;

    var control = known_controls[values.key]
    if(control) {
      send_command({
        type: 'control_change',
	control: control,
	value: parseInt(values.value / 10.0 * 127)
      })
    }

    if(values.midi) {
      send_command(values.midi);
    }
    socket.broadcast.emit('set', values);
    save();
  });
});

console.log("READY")
