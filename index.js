#!/usr/bin/env node

const browserify = require('browserify');
const fs = require('sacred-fs');
const argv = require('minimist')(process.argv.slice(2));
const path = require('path');
const UglifyJS = require('uglify-es');
const babelify = require('babelify');
const { stdout, stderr } = require('process');

main().catch((e)=>{
    stderr.write(e.toString() + '\n');
    throw e;
});

/**
 * 
 * @param {Object} param
 * @param {String} param.name
 * @param {String} param.text
 * @param {String} param.description
 * @param {*} param.default
 * @param {String} param.type
 * @param {Object} param.switch
 * @param {Object} param.options
 * @param {Array} param.children
 */
function writeParam(param, parent) {
    _writeParams(param, ['name', 'text', 'description', 'default', 'type'], {
        name: 'param',
        description: 'desc',
    });
    if (param.switch) {
        if (param.switch.on !== undefined)
            stdout.write(` * @type ${param.switch.on}\n`);
        if (param.switch.off !== undefined)
            stdout.write(` * @type ${param.switch.off}\n`);
    }
    if  (param.options) {
        for (let key in param.options) {
            let value = param.options[key];
            stdout.write(` * @option ${value}\n * @value ${key}\n`);
        }
    }
    if (parent)
        stdout.write(` * @parent ${parent.name}\n`);
    
    if (param.children) {
        for (let child of param.children) {
            writeParam(child, param);
        }
    }
}

/**
 * 
 * @param {Object} command 
 * @param {String} command.name
 * @param {String} command.text
 * @param {String} command.description
 * @param {Array} command.args
 */
function writeCommand(command) {
    _writeParams(command, ['name', 'text', 'description'], {
        name: 'command',
        description: 'desc'
    });

    for (let arg of command.args) {
        _writeParams(arg, ['name', 'text', 'type', 'description', 'default'], {
            name: 'arg',
            description: 'desc'
        });
    }
}

/**
 * 
 * @param {Object} params 
 * @param {Array<String>} keys 
 */
function _writeParams(params, keys, keyMap = {}) {
    stdout.write(' *\n');

    for (let key of keys) {
        let keyWord = keyMap[key] ? keyMap[key] : key;
        let value = params[key];

        if (value !== undefined) {
            stdout.write(` * @${keyWord} ${value}\n`);
        }
    }
}

function streamToString (stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', (err) => reject(err));
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    })
  }

async function main() {
    let dir = argv._[0];
    let config = JSON.parse(await fs.readFile(path.join(dir, 'package.json')));

    let target = argv.target || 'MZ';
    let pk_name = argv.name || config.name;
    let pk_des = argv.des || config.description;
    let pk_version = argv.version || config.version;
    let pk_author = config.author;
    let js_main = argv.main || config.main;
    let pk_params = config.params;
    let pk_commands = config.commands;

    let output = await fs.createWriteStream(path.join(dir, pk_name + '.js'));
    stdout.write = output.write.bind(output);

    stdout.write(
        "//=============================================================================\n" +
        "// This RPG Maker Plugin is generated by rmmzp\n" +
        "//=============================================================================\n\n"
    );

    stdout.write("/*:\n");
    stdout.write(` * @target ${target}\n`);
    stdout.write(` * @plugindesc (v${pk_version}) ${pk_des}\n`);
    if (pk_author) {
        stdout.write(` * @author ${pk_author}\n`);
    }
    if (pk_params) {
        for (let param of pk_params) {
            writeParam(param);
        }
    }
    if (pk_commands) {
        for (let command of pk_commands) {
            writeCommand(command);
        }
    }
    stdout.write(" */\n");

    let br = browserify({
    });
    if (argv.b) {
        br.transform(babelify, {
            global: true,
            presets: ["@babel/preset-env"],
            plugins: ["@babel/plugin-proposal-class-properties", "@babel/plugin-transform-runtime"],
        });
    }
    br.require(path.join(dir, js_main), { entry: true });
    if (argv.external) {
        br.external(argv.external);
    }
    if (argv.ignore) {
        br.ignore(argv.ignore);
    }
    
    let result = await streamToString(br.bundle());
    if (argv.c) {
        var res = UglifyJS.minify(result);
        if (res.error) {
            throw res.error;
        } else {
            result = res.code;
        }
    }
    stdout.write(result);
}
