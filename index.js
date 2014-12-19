#!/usr/bin/env node
var argv = require('minimist')(process.argv, {
    'string': ['help', 'email'],
    'integer': ['test'],
    'boolean': ['skip', 'debug']
});

if (argv.help || !argv.email) {
    console.log('./index.js FILE --email EMAIL [--test ROWS] [--skip] [--debug]');
    console.log('FILE a file containing the name of one location per line');
    console.log('--test ROWS Number of rows to test with');
    console.log('--skip Skip errors and continue');
    console.log('--debug Print API calls to stderr');
    process.exit();
}
var input = argv._[2];
var request = require('request'),
    fs = require('fs'),
    readline = require('readline'),
    stream = require('stream'),
    parser = require('xml2json');

var baseNom = 'http://nominatim.openstreetmap.org/search/';
var params = '?format=jsonv2&limit=1&email=' + argv.email;
var baseOSM = 'http://api.openstreetmap.org/api/0.6/';
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
    if (argv.test && argv.test < queries.length) queries = queries.slice(0, argv.test);
    lookup(0);
});

var languages = [];

function lookup(i) {
    if (i === queries.length -1) writer();
    else {
        if (argv.debug) console.error(baseNom + encodeURIComponent(queries[i].query + params));
        request.get(baseNom + encodeURIComponent(queries[i].query + params), function(err, res, body) {
            if (err || res.statusCode !== 200) setTimeout(function () { lookup(i);}, 1500);
            else {
                var result = JSON.parse(body)[0];
                if (!result || !result.osm_type || !result.osm_id) {
                    console.error("Could not parse Nominatim response for ", queries[i].query);
                    console.error(body);
                    if (argv.skip) setTimeout(function() {lookup(++i); }, 1500);
                    else process.exit(1);
                } else {
                    queries[i].type = result.osm_type;
                    queries[i].id = result.osm_id;
                    if (argv.debug) console.error(baseOSM + queries[i].type + "/" + queries[i].id);
                    request.get(baseOSM + queries[i].type + "/" + queries[i].id, function(err, res, body) {
                        if (err || res.statusCode !== 200) setTimeout(function () { lookup(i);}, 1500);
                        else {
                            var obj;
                            try {
                                obj = JSON.parse(parser.toJson(body));
                            } catch (err) {
                                obj = null;
                            }
                            if (!obj || !obj.osm[queries[i].type].tag) {
                                console.error("Could not parse OSM response for ", queries[i].query);
                                console.error(body);
                                if (argv.skip) setTimeout(function() {lookup(++i); }, 1500);
                                else process.exit(1);
                            } else {
                                obj.osm[queries[i].type].tag.forEach(function(tag) {
                                    if (tag.k.indexOf('name') !== -1) {
                                        if (languages.indexOf(tag.k) === -1) languages.push(tag.k);
                                        queries[i][tag.k] = tag.v;
                                    }
                                });
                                setTimeout(function() {lookup(++i); }, 1500);
                            }
                        }
                    });
                }
            }
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
