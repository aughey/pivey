var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var _ = require('underscore');
var fs = require('fs')
const {spawn} = require('child_process');
var bodyParser = require('body-parser');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

if (process.argv.length == 2) {
  var command_process = spawn("python3", ['./send_command.py'])
  var command_switch = spawn("python3", ['./switch_read.py'])

  command_switch.stdout.on('data', (data) => {
    data = parseInt(data.toString(), 10)
    send_command({type: 'program_change', program: data})
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
  command_process.stdin.write(JSON.stringify(data) + "\n")
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

io.on('connection', function(socket) {
  console.log("Connection");
  socket.emit('state', state);
  socket.on('set', (values) => {
    console.log(values)

    state[values.key] = values.value;
    if(values.midi) {
    }
    send_command(values.midi);
    socket.broadcast.emit('set', values);
    save();
  });
});

console.log("READY")
