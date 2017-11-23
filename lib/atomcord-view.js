'use babel';

let EventEmitter = require("events")
let net = require("net")

export default class AtomRichPresenceView {
  constructor(serializedState) {
    window.oof = this
    this.socketAddress = process.platform == "win32" ?
      "\\\\?\\pipe\\discord-ipc-0" : `${process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || "/tmp"}/discord-ipc-0`
    this.rpc = new RPCClient(this.socketAddress, "382999630062813207", "atom_large", "github_small")
    this.rpc.connect()
  }

  // Returns an object that can be retrieved when package is activated
  serialize() {
    return this.rpc
  }

  // Tear down any state and detach
  destroy() {
    this.rpc.disconnect();
  }

}

class RPCClient extends EventEmitter {
  constructor(socketPath, clientId, largeAsset, smallAsset) {
    super()
    this.largeAsset = largeAsset || ""
    this.smallAsset = smallAsset || ""
    this.socketPath = socketPath
    this.clientId = clientId
    this.connected = false
    this.ready = false
    this.on("disconnect", () => {
      this.ready = false
      this.connected = false
      if(!this.disconnected) this.connect()
    })
    this.on("connect", () => {
      this.connected = true
      this.sendPacket(0, {
        v: 1,
        client_id: this.clientId
      })
    })
    this.on("data", data => {
      this.ready = true
      this.connected = true
      this.emit("ready")
    })
    atom.workspace.observeTextEditors(editor => {
        this.editor = editor
        this.editor.onDidChangeCursorPosition(evnt => {
          return
          this.editor = evnt.cursor.editor
          this.cursorPosition = evnt.newBufferPosition
          // We only update presence if it's a different line!
          if(evnt.newBufferPosition.row == (evnt.oldBufferPosition && evnt.oldBufferPosition.row)) {
            return
          }

          this.createUpdate()
        })
    })
  }

  disconnect() {
    this.ready = false
    this.connected = false
    this.disconnected = true
    this.socket.disconnect()
  }

  connect() {
    this.socket = net.createConnection(this.socketPath)
    this.socket.on("connect", () => this.emit("connect"))
    this.socket.on("close", () => this.emit("disconnect"))
    this.socket.on("data", data => this.emit("data", data))
  }

  async createUpdate() {
    if(!this.cursorPosition) return
    let pres = {
      filename: this.editor.getFileName(),
      lineNumber: this.cursorPosition.row + 1,
      lineCount: this.editor.getLineCount(),
    }
    this.sendPresence({
      assets: {
        large_image: this.largeAsset,
        small_image: this.smallAsset,
        large_text: this.largeTooltip,
        small_text: this.smallTooltip
      },
      details: `Editing ${pres.filename}`,
      state: `Line ${pres.lineNumber}`,
      party: {
        id: "atom",
        size: [pres.lineNumber, pres.lineCount]
      },
      //  Uncomment these to have the ability to invite users to spectate/play
      // secrets: {
      //   join: `join-atom`,
      //   spectate: `spectate-atom`,
      //   match: "match-atom"
      // }
    })
  }

  sendPresence(pres) {
    this.sendPacket(1, {
      cmd: "SET_ACTIVITY",
      args: {
        activity: pres,
        pid: process.pid
      },
      nonce: new Date().getTime()
    })
  }

  sendPacket(op, body) {
    let strBody = JSON.stringify(body)
    let len = Buffer.byteLength(strBody)
    let resBuffer = Buffer.alloc(8 + len)
    resBuffer.writeInt32LE(op, 0)
    resBuffer.writeInt32LE(len, 4)
    resBuffer.write(strBody, 8, len)
    this.socket.write(resBuffer)
  }
}
