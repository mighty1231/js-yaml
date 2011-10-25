JS.require('JS.Class');


var fs = require('fs');
var __ = require('./import')('error');
var NON_PRINTABLE = new RegExp('[^\x09\x0A\x0D\x20-\x7E\x85\xA0-\uD7FF\uE000-\uFFFD]');


var ReaderError = exports.ReaderError = new JS.Class('ReaderError', __.YAMLError, {
  initialize: function (name, position, character, encoding, reason) {
    this.name = name;
    this.position = position;
    this.character = character;
    this.encoding = encoding;
    this.reason = reason;
  },

  toString: function () {
    return  'unacceptable character ' + this.character + ': ' + this.reason +
            '\n in "' + this.name + '", position ' + this.position;
  }
});


exports.Reader = new JS.Class('Reader', {
  initialize: function (stream) {
    this.name = '<unicode string>';
    this.stream = null;
    this.streamPointer = 0;
    this.eof = true;
    this.buffer = '';
    this.pointer = 0;
    this.rawBuffer = null;
    this.encoding = 'utf-8';
    this.index = 0;
    this.line = 0;
    this.column = 0;

    if ('string' === typeof stream) { // simple string
      this.name = '<unicode string>';
      this.checkPrintable(stream);
      this.buffer = stream + '\0';
    } else if (Buffer.isBuffer(stream)) { // buffer
      this.name = '<buffer>';
      this.rawBuffer = stream;
      this.update(1);
    } else { // file descriptor
      this.name = '<file>';
      this.stream = stream;
      this.eof = false;
      this.updateRaw();
      this.update(1);
    }
  },

  peek: function (index) {
    index = +index || 0;
    try {
      return this.buffer[this.pointer + index];
    } catch (e) {
      this.update(index + 1);
      return this.buffer[this.pointer + index];
    }
  },

  prefix: function (length) {
    length = +length || 1;
    if (this.pointer + length >= this.buffer.length) {
      this.update(length);
    }
    return this.buffer.slice(this.pointer, this.pointer + length);
  },

  forward: function (length) {
    var char;

    length = +length || 1;

    if (this.pointer + length + 1 >= this.buffer.length) {
      this.update(length + 1);
    }

    while (length) {
      char = this.buffer[this.pointer];
      this.pointer++;
      this.index++;
      if (/^[\n\x85\u2028\u2029]$/.test(char)
          || ('\r' === char && '\n' !== this.buffer[this.pointer])) {
        this.line++;
        this.column = 0;
      } else if (!/^\uFEFF$/.test(char)) {
        this.column++;
      }
      length--;
    }
  },

  getMark: function () {
    if (null === this.stream) {
      return new __.Mark(this.name, this.index, this.line, this.column,
                         this.buffer, this.pointer);
    } else {
      return new __.Mark(this.name, this.index, this.line, this.column,
                         null, null);
    }
  },


  checkPrintable: function (data) {
    var match = data.toString().match(NON_PRINTABLE), position;
    if (match) {
      position = this.index + this.buffer.length - this.pointer + match.index;
      throw new ReaderError(this.name, position, match[0],
                            'unicode', 'special characters are not allowed');
    }
  },

  update: function (length) {
    var data;

    if (null === this.rawBuffer) {
      return;
    }

    this.buffer = this.buffer.slice(this.pointer);
    this.pointer = 0;

    while (this.buffer.length < length) {
      if (!this.eof) {
        this.updateRaw();
      }

      data = this.rawBuffer;

      this.checkPrintable(data);
      this.buffer += data;
      this.rawBuffer = this.rawBuffer.slice(data.length);

      if (this.eof) {
        this.buffer += '\0';
        this.rawBuffer = null;
        break;
      }
    }
  },

  updateRaw: function (size) {
    var data = new Buffer(+size || 4096),
        count = fs.readSync(this.stream, data, 0, data.length),
        tmp;

    if (null === this.rawBuffer) {
      this.rawBuffer = data.slice(0, count);
    } else {
      tmp = new Buffer(this.rawBuffer.length + count);
      this.rawBuffer.copy(tmp);
      data.copy(tmp, this.rawBuffer.length);
      this.rawBuffer = tmp;
    }

    this.streamPointer += count;

    if (!count) {
      this.eof = true;
    }
  }
});


////////////////////////////////////////////////////////////////////////////////
// vim:ts=2:sw=2
////////////////////////////////////////////////////////////////////////////////