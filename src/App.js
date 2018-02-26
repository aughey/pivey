import React, {Component} from 'react';
import './App.css';
import jquery from 'jquery'
import io from 'socket.io-client';

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
        <h4>{this.props.title}</h4>
        <div className="value">{this.props.value}</div>
        <input onChange={(v) => this.newValue(v.target.value)} type='range' min={0} max={10} step={0.1} value={this.props.value}/>
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
      <div>{controls}</div>
    )
  }
}

class AmpParameters extends Parameters {
  parameters() {
    return ["Pre-Gain", "Low", "Mid", "High", "Post-Gain"]
  }
}

class ButtonSelector extends React.PureComponent {
  prefix() {
    return "";
  }
  title() {
    return "TITLE";
  }
  render() {
    var title = null;
    if (this.title()) {
      title = <h1>{this.title()}</h1>
    }
    var buttons = this.options().map((p) => {
      var c = "btn";
      if (this.props.selection === p) {
        c = c + " btn-success"
      }
      return <button key={p} className={c} onClick={() => this.props.onChange(p)}>{this.prefix()} {p}</button>
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

class GenericButtonSelecttor extends ButtonSelector {
  title() {
    return this.props.title
  }
  options() {
    return this.props.options
  }
}

class AmpType extends ButtonSelector {
  title() {
    return "Pre-Amp Type";
  }
  options() {
    return ["Clean", "Crunch", "Lead"]
  }
}

class Amps extends ButtonSelector {
  title() {
    return "Amp Models"
  }
  options() {
    return [
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
      "Peavey",
      "British"
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
    this.socket = io();
    this.socket.on('state', (s) => {
      this.setState({serverState: s});
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

export class InsideApp extends Component {
  constructor(props) {
    console.log("INSIDEAPP CREATED")
    super(props);
    this.state = {
      mode: 'Amp'
    }
  }

  setValue = (key, value) => {
    var obj = {}
    obj[key] = value;
    this.props.socket.emit('set', obj);
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
    var serverState = this.props.serverState;

    if (mode === 'Presets') {
      mode_content = <Patch onChange={(num) => this.setValue('preset', num)} selection={serverState.preset}/>
    } else if (mode === 'Instrument') {} else if (mode === 'Amp') {
      mode_content = <Instrument/>
      mode_content = (
        <div><Amps onChange={(amp) => this.setValue('amp', amp)} selection={serverState.amp}/>
          <AmpType onChange={(type) => this.setValue('amptype', type)} selection={serverState.amptype}/>
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
