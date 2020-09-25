// kju server

/* NOTES

- access key (jwt) with privileges?
    - read message
    - redeem responses
    - see responses
- 

@TODO:

 - transport layer (email, whatsapp, ...)
 - response actions (puzzle-based kju actions like: [emails, http calls, ...])
 - rate limiter

*/

const express = require('express');
const OBJY = require('objy');
var shortid = require('shortid');
var cors = require('cors');
var bodyParser = require('body-parser');
var moment = require("moment");
var jwt = require('jsonwebtoken');
var mongoose = require('mongoose');
var KEY = 'ASDDSGq2d,öa-#'

var app = express();

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json({
    limit: '300mb'
}));

app.use(cors());
app.options('*', cors());

var router = express.Router();

var observer = {
    initialize: function() {

    },
    run: function() {

    },
    setObjectFamily: function() {

    }
}


var KJU = function(options) {

    OBJY.client('public');
    OBJY.app('kju');


    OBJY.define({
        name: "message",
        pluralName: "mesages",
        observer: observer,
        storage: options.dbMapper,
    })

    OBJY.define({
        name: "callLog",
        pluralName: "callLogs",
        observer: observer,
        storage: options.dbMapper,
    })

    OBJY.define({
        name: "token",
        pluralName: "tokens",
        observer: observer,
        storage: options.dbMapper,
    })

    var isObject = function(a) {
        return (!!a) && (a.constructor === Object);
    };

    var responsesToArray = function(res) {
        var arr = [];
        Object.keys(res).forEach(function(r) {
            arr.push({ title: r, link: res[r].properties.link })
        })
        return arr;
    }

    router.route('/creationToken')

        // get a token
        .post(function(req, res) {

            var token = jwt.sign({ hash: shortid.generate(), priv: '*' }, KEY);

            OBJY.token({
                properties: {
                    data: token
                }
            }).add(data => {
                res.json(data.properties)
            }, err => {
                res.status(400).json({ err: err })
            })

        });

    router.route('/message')

        // create a message
        .post(function(req, res) {

            if (!req.query.token && !req.body.token)
                return res.status(400).json({ err: 'no token provided' });

            OBJY.tokens({ "properties.data": req.query.token || req.body.token }).get(data => {

                if (data.length != 1)
                    return res.status(400).json({ err: 'token not found' })

                if (!jwt.verify(req.query.token || req.body.token, KEY))
                    return res.status(400).json({ err: 'invalid token' })

                var msgId = new mongoose.Types.ObjectId();

                var consumerToken = jwt.sign({ msgId: msgId, hash: shortid.generate(), priv: 'redeem' }, KEY);

                var computedResponses = {};

                var url = req.protocol + '://' + req.get('host') + '/kju-dummy'

                if (Array.isArray(req.body.responses)) {
                    req.body.responses.forEach(res => {
                        if (isObject(res)) {

                            computedResponses[res.title || shortid.generate()] = {
                                type: "longText",
                                properties: {
                                    content: res.content,
                                    link: url + '/api/message/' + msgId + '/response/' + (res.title || shortid.generate()) + '?token=' + consumerToken
                                }
                            }

                        } else {
                            computedResponses[res] = {
                                type: "bag",
                                properties: {
                                    content: res.content,
                                    link: url + '/api/message/' + msgId + '/response/' + res + '?token=' + consumerToken
                                }
                            }
                        }
                    })
                }


                OBJY.message({
                    name: req.body.content,
                    _id: msgId,
                    properties: {
                        content: {
                            type: "longText",
                            value: req.body.content
                        },
                        responses: {
                            type: "bag",
                            properties: computedResponses
                        },
                        consumerToken: {
                            type: "longText",
                            value: consumerToken
                        }
                    }
                }).add(data => {
                    res.json({
                        _id: msgId,
                        content: data.properties.content.value,
                        responses: responsesToArray(data.properties.responses.properties),
                        consumerToken: data.properties.consumerToken.value
                    })
                }, err => {
                    res.status(400).json({ err: "an error occured" })
                })

            }, err => {
                res.status(400).json({ err: err })
            })


        });


    router.route('/message/:messageId')

        // get a single message
        .get(function(req, res) {

            // TODO: check consumer token

            OBJY.message(req.params.messageId).get((data) => {
                res.json({
                    content: data.properties.content.value,
                    responses: responsesToArray(data.properties.responses.properties),
                    consumerToken: data.properties.consumerToken.value
                })
            }, err => {
                console.log(err)
                res.status(404).json({ err: "error getting message" })
            })
        });

    router.route('/message/:messageId/responses')

        // get the responses for a message
        .get(function(req, res) {

            // TODO: check consumer token

            OBJY.message(req.params.messageId).get((data) => {

                OBJY.callLogs({ name: req.params.messageId }).get(data => {


                    var resp = [];

                    data.forEach(function(d) {
                        resp.push({
                            _id: d._id,
                            timestamp: d.created,
                            response: d.properties.response.value
                        })
                    })

                    res.json(resp);

                })

            }, err => {
                res.status(404).json({ err: "error getting message" })
            })
        });


    router.route('/message/:messageId/response/:responseId')

        // redeem a response
        .get(function(req, res) {

            // TODO: check consumer token

            OBJY.message(req.params.messageId).get((data) => {

                console.log('dataaaaa', data);

                var resp = data.properties.responses.properties[req.params.responseId];

                if (!resp)
                    return res.status(404).json({ err: "response not found" });

                /*
                // call action
                if (resp.action)
                    puzzle.parse(resp.action);
                */


                OBJY.callLog({
                    name: req.params.messageId,
                    properties: {
                        message: {
                            type: "shortText",
                            value: req.params.messageId
                        },
                        response: {
                            type: "shortText",
                            value: req.params.responseId
                        }
                    }
                }).add(data => {
                    res.json({
                        msg: "ok"
                    })
                }, err => {
                    res.status(400).json({ err: 'error redeeming response' })
                })


            }, err => {
                res.status(404).json({ err: "error getting message" })
            })

        });


    app.listen(options.port || 80);
    app.use('/api', router);

    console.log('kju server running');

    return {
        server: app
    }

}

module.exports = KJU;