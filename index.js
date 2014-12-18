#!/usr/bin/env node
var argv = require('minimist')(process.argv, {
    'string': ['help', 'email'],
});

if (argv.help || !argv.email) {
    console.log('./index.js FILE\n --email EMAIL');
    console.log('Where FILE the name of one location per line');
    process.exit();
}
var input = argv._[2];
var request = require('request'),
    fs = require('fs'),
    readline = require('readline'),
    stream = require('stream'),
    parser = require('xml2json');

var baseNom = 'http://nominatim.openstreetmap.org/search/'
var params = '?format=jsonv2&limit=1&email=' + argv.email;
var baseOSM = 'http://api.openstreetmap.org/api/0.6/'
var queries = [];
var fileInput = fs.createReadStream(input);

var rl = readline.createInterface({
    input: fileInput,
    output: new stream()
});

rl.on('line', function (line) {
   queries.push({ "query": line.split('"').join('') }); 
});

rl.on('close', function () {
    lookup(0);
});

var languages = [];

function lookup(i) {
    if (i === queries.length - 1) writer();
    else {
        request.get(baseNom + encodeURIComponent(queries[i].query + params), function(err, res, body) {
            if (err) setTimeout(function () { lookup(i);}, 1500);
            var result = JSON.parse(body)[0];
            queries[i].type = result.osm_type;
            queries[i].id = result.osm_id;
            request.get(baseOSM + queries[i].type + "/" + queries[i].id, function(err, res, body) {
            if (err) setTimeout(function () { lookup(i);}, 1500);
                var obj = JSON.parse(parser.toJson(body));
                obj.osm[queries[i].type].tag.forEach(function(tag) {
                    if (tag.k.indexOf('name') !== -1) {
                        if (languages.indexOf(tag.k) === -1) languages.push(tag.k);
                        queries[i][tag.k] = tag.v;
                    }
                });

                setTimeout(function() {lookup(++i); }, 1500);
            });;
        }); 
    }
}

function writer() {
    var header = "id,type,query";
    languages.forEach(function(lang) {
        header = header + "," + lang;
    });
    console.log(header);
    
    queries.forEach(function(query) {
        var row = query.id + ',' + query.type + ',"' + query.query + '"';
        languages.forEach(function(lang) {
            row = query[lang] ? row + ',"' + query[lang] + '"' : row +  ',';
        });
        console.log(row);
    });
}
