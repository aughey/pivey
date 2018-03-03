import React, {Component} from 'react';
import './App.css';
import jquery from 'jquery'
import io from 'socket.io-client'
import PropTypes from 'prop-types'

class Knob extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: props.value
    }
  }
  newValue = (v) => {
    this.setState({value: v})
    this.props.onChange(v);
  }
  render() {
    return (
      <div className="knob">
        <h4 className="title">{this.props.title}</h4>
        <div className="value">{this.props.value}</div>
        <input onChange={(v) => this.newValue(v.target.value)} type='range' min={0} max={127} step={1} value={this.props.value}/>
      </div>
    )
  }
}

class Parameters extends React.PureComponent {
  render() {
    var values = this.props.values
    var controls = this.parameters().map((p) => {
      return (<Knob onChange={(v) => this.props.onChange(p, v)} key={p} title={p} value={values[p]}/>)
    })
    return (
      <div className="parameters">{controls}</div>
    )
  }
  parameters() {
    return this.props.parameters
  }
}

class AmpParameters extends Parameters {
  parameters() {
    return [
      "Pre-Gain",
      "Low",
      "Mid",
      "High",
      "Post-Gain",
      "Delay Feedback",
      "Delay Level",
      "Reverb"
    ]
  }
}

class ButtonSelector extends React.PureComponent {
  prefix() {
    return "";
  }

  title() {
    return this.props.title
  }
  options() {
    return this.props.options
  }
  render() {
    var title = null;
    if (this.title()) {
      title = <h1>{this.title()}</h1>
    }
    var buttons = this.options().map((p, index) => {
      var c = "btn";
      if (this.props.selection === p) {
        c = c + " btn-success"
      }
      return <button key={p} className={c} onClick={() => this.props.onChange(p, index)}>{this.prefix()} {p}</button>
    })
    return (
      <div>
        {title}
        {buttons}
      </div>
    )
  }
}

class Patch extends ButtonSelector {
  title() {
    return "Presets"
  }
  prefix() {
    return "Prefix"
  }
  options() {
    return [0, 1, 2, 3];
  }
}

class Instrument extends Component {
  render() {
    return (
      <div>
        <h1>Instrument</h1>
      </div>
    )
  }
}

class AmpType extends ButtonSelector {
  title() {
    return "Pre-Amp Type";
  }
  options() {
    return ["High Gain", "Medium Gain", "Low Gain"]
  }
}

class Amps extends ButtonSelector {
  title() {
    return "Amp Models"
  }
  options() {
    return [
      "British",
      "Butcher",
      "Classic",
      "XXX",
      "6534",
      "6505",
      "Budda",
      "Twn",
      "A-Trace",
      "Ecous",
      "B-Trace",
      "Peavey"
    ]
  }
}

class Modes extends ButtonSelector {
  title() {
    return null;
  }
  options() {
    return ["Presets", "Instrument", "Stomp Box", "Amp", "Effect"]
  }
}

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      serverState: null
    }
  }
  componentDidMount() {
    this.socket = io("192.168.0.116:8080");
    this.socket.on('state', (s) => {
      this.setState({serverState: s});
    })
    this.socket.on('set', (s) => {
      var data = {}
      data[s.key] = s.value;
      this.setState({
        serverState: Object.assign(this.state.serverState, data)
      });
    })

    this.socket.on('connect', () => {
      console.log("Connected")
      this.setState({connected: true})
    });
    this.socket.on("disconnect", () => {
      this.setState({connected: false, serverState: null})
    })
  }
  render() {
    if (this.state.connected && this.state.serverState) {
      return <InsideApp socket={this.socket} serverState={this.state.serverState}/>
    } else {
      return (
        <h1>Waiting for connection...</h1>
      )
    }
  }
}

class ParameterMapper extends React.PureComponent {
  render() {
    var serverState = this.props.serverState;
    var effect_mapping = this.props.effectMapping;
    var p1 = this.props.paramPrefix + "P1"
    var p2 = this.props.paramPrefix + "P2"
    var parameter_key = this.props.parameterKey

    var params = effect_mapping.find((e) => e[0] === serverState[parameter_key])
    if (!params) {
      console.log("Error: Couldn't find effect mapping for " + parameter_key);
      params = [p1, p2]
    }
    var values = {}

    if (params[1].length !== 0) {
      values[params[1][0]] = serverState[p1]
      values[params[1][1]] = serverState[p2]
    }
    return (
      <div>
        <ButtonSelector onChange={(t, index) => this.props.onChangeType(t, index)} title={this.props.title} selection={serverState[parameter_key]} options={effect_mapping.map((e) => e[0])}/>
        <Parameters values={values} onChange={(param, value) => this.props.onChangeParameter(param === params[1][0]
          ? p1
          : p2, value)} parameters={params[1]}/>
      </div>
    )
  }
}

ParameterMapper.defaultProps = {
  paramPrefix: ""
}

ParameterMapper.propTypes = {
  effectMapping: PropTypes.array.isRequired,
  parameterKey: PropTypes.string.isRequired,
  serverState: PropTypes.object.isRequired,
  title: PropTypes.string.isRequired
}

export class InsideApp extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mode: 'Amp',
      serverState: props.serverState
    }
  }

  setValue = (key, value, midi) => {
    var obj = {
      key: key,
      value: value,
      midi: midi
    }
    this.props.socket.emit('set', obj);
    var newstate = {}
    newstate[key] = value
    this.setState({
      serverState: Object.assign(this.state.serverState, newstate)
    })
  }

  componentWillReceiveProps(nextProps) {
    this.setState({serverState: nextProps.serverState})
  }

  setMode = (mode) => {
    this.setState({mode: mode})
  }

  patch(num) {
    this.setState({patch: num})
    console.log("Patch " + num)
    jquery.post("/command", {
      type: "program_change",
      program: num
    });
  }

  render() {
    var mode = this.state.mode;
    var mode_content = null;
    var serverState = this.state.serverState;
    if (mode === 'Presets') {
      mode_content = <Patch onChange={(num) => this.setValue('preset', num)} selection={serverState.preset}/>
    } else if (mode === 'Stomp Box') {
      mode_content = <ParameterMapper serverState={serverState} parameterKey="stompbox" title="Stomp Box" paramPrefix="SB_" onChangeType={(v) => this.setValue('stompbox', v)} onChangeParameter={(k, v) => this.setValue(k, v)} effectMapping={[
        ["BYPASS", []
        ],
        [
          "12 String",
          ["Body", "Brightness"]
        ],
        [
          "7 String",
          ["Body", "String"]
        ],
        [
          "Acoustic 1",
          ["Body", "String"]
        ],
        [
          "Acoustic 2",
          ["Body", "String"]
        ],
        [
          "Baritone",
          ["Body", "String"]
        ],
        [
          "BASS",
          ["Body", "String"]
        ],
        [
          "EVIO",
          ["Color", "Glide"]
        ],
        [
          "Resonator",
          ["Body", "String"]
        ],
        [
          "SITAR",
          ["Body", "String"]
        ],
        [
          "TSC",
          ["Drive", "Level"]
        ],
        [
          "Fuzz",
          ["Drive", "Level"]
        ],
        [
          "Comp",
          ["Sensitivity", "Level"]
        ],
        [
          "Slap",
          ["Time", "Mix"]
        ],
        ["AutoWah", ["Speed Depth"]
        ],
        [
          "Analog Phase",
          ["Speed", "Depth"]
        ],
        [
          "Analog Flange",
          ["Speed", "Depth"]
        ],
        [
          "Synth",
          ["Attack", "Glide"]
        ],
        [
          "Slicer",
          ["Speed", "Width"]
        ],
        ["Chorus", ["Speed Depth"]
        ],
        [
          "UVB",
          ["Speed", "Depth"]
        ],
        [
          "Ring",
          ["Frequency", "Mix"]
        ],
        [
          "Vibrato",
          ["Speed", "Depth"]
        ],
        [
          "Boost",
          ["Drive", "Level"]
        ]
      ]}/>

    } else if (mode === 'Effect') {
      var effect_mapping = [
        [
          "BYPASS", [], 5
        ],
        [
          "Tremolo",
          [
            "Speed", "Depth"
          ],
          6
        ],
        [
          "Octaver",
          [
            "Mix", "Octave Level"
          ],
          7
        ],
        [
          "Phaser",
          [
            "Speed", "Depth"
          ],
          8
        ],
        [
          "Rotary",
          [
            "Speed", "Depth"
          ],
          9
        ],
        [
          "Reverse",
          [
            "Time", "Mix"
          ],
          10
        ],
        [
          "Pitch Shift",
          [
            "Time", "Mix"
          ],
          11
        ],
        [
          "MOG",
          [
            "Octave Up", "Octave Down"
          ],
          0
        ],
        [
          "Flanger",
          [
            "Speed", "Depth"
          ],
          1
        ],
        [
          "Compressor",
          [
            "Sensitivity", "Level"
          ],
          2
        ],
        [
          "Env Filter",
          [
            "Sensitivity", "Level"
          ],
          3
        ],
        [
          "Chorus",
          [
            "Speed", "Depth"
          ],
          4
        ]
      ]
      mode_content = (<ParameterMapper serverState={serverState} parameterKey="Effect" title="Effect" paramPrefix="" onChangeType={(v, index) => this.setValue('Effect', v, effect_mapping[index][2])} onChangeParameter={(k, v) => this.setValue(k, v)} effectMapping={effect_mapping}/>)
    } else if (mode === 'Instrument') {} else if (mode === 'Amp') {
      mode_content = <Instrument/>
      mode_content = (
        <div><Amps onChange={(amp, index) => this.setValue('Amp', amp, index)} selection={serverState.Amp}/>
          <AmpType onChange={(type, index) => this.setValue('amptype', type, index)} selection={serverState.amptype}/>
          <AmpParameters values={serverState} onChange={(param, value) => this.setValue(param, value)}/>
        </div>
      )
    } else {
      mode_content = (
        <div>Unknown Mode {mode}</div>
      )
    }

    return (
      <div className="PiveyApp">
        {this.state.mode}
        <header>
          <Modes onChange={this.setMode} selection={this.state.mode}/>
        </header>

        {mode_content}
      </div>
    )
  }
}
