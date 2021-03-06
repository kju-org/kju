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
const OBJY_CATALOG = require('objy-catalog');
var shortid = require('shortid');
var cors = require('cors');
var bodyParser = require('body-parser');
var moment = require("moment");
var jwt = require('jsonwebtoken');
var mongoose = require('mongoose');
const RateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

var KEY = 'ASDDSGq2d,öa-#'
var HOST = "europe-west3-spoocloud-202009.cloudfunctions.net";

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

    const limiter = new RateLimit({
        store: new RedisStore({
            client: new Redis(options.redisCon || 'redis://localhost')
        }),
        windowMs: 10 * 60 * 1000,
        max: 50, // limit each IP to 100 requests per windowMs
        delayMs: 0, // disable delaying - full speed until the max limit is reached
        message: {
            err: "too many requests. Try again later"
        }
    });

    app.use(limiter);

    OBJY.define({
        name: "message",
        pluralName: "messages",
        observer: observer,
        storage: new OBJY_CATALOG.mappers.storage.mongo(OBJY).useConnection(options.dbMapper, function() {})
    })

    OBJY.define({
        name: "callLog",
        pluralName: "callLogs",
        observer: observer,
        storage: new OBJY_CATALOG.mappers.storage.mongo(OBJY).useConnection(options.dbMapper, function() {})
    })

    OBJY.define({
        name: "correspondence",
        pluralName: "correspondences",
        observer: observer,
        storage: new OBJY_CATALOG.mappers.storage.mongo(OBJY).useConnection(options.dbMapper, function() {})
    })

    OBJY.define({
        name: "token",
        pluralName: "tokens",
        observer: observer,
        storage: new OBJY_CATALOG.mappers.storage.mongo(OBJY).useConnection(options.dbMapper, function() {})
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

    router.route('/')

        .get(function(req, res) {

            res.json({
                msg: "welcome to kju"
            })

        });

    router.route('/personalToken')

        // get a token
        .post(function(req, res) {

            var contact = (req.body || {}).contact;

            if (!contact) {
                return res.status(400).json({ err: 'no contact provided' });
            }

            var token = jwt.sign({ hash: shortid.generate(), priv: '*', contact: contact }, KEY);

            OBJY.token({
                properties: {
                    data: token
                }
            }).add(data => {
                //res.json(data.properties)
                if (options.transporter) options.transporter.transport({
                    reciever: contact,
                    content: 'Your personal token for kju: ' + token
                });

                res.json({ msg: 'token has been sent to you' });

            }, err => {
                res.status(400).json({ err: err })
            })

        });


    router.route('/permitCorrespondence')

        // get a token
        .post(function(req, res) {

            if (!req.query.token && !req.body.token)
                return res.status(400).json({ err: 'no token provided' });

            var contact = (req.body || {}).contact;

            if (!contact) {
                return res.status(400).json({ err: 'no contact provided' });
            }

            var decoded = jwt.verify(req.query.token || req.body.token, KEY);

            if (!decoded)
                return res.status(400).json({ err: 'invalid token' })

            OBJY.correspondences({ "properties.sender.value": contact, "properties.reciever.value": decoded.contact }).get(data => {
                if (data.length > 0 && !data[0].properties.permitted.value) {
                    data[0].setPropertyValue('permitted', true).update(data => {
                        return res.json({
                            msg: 'ok'
                        })
                    }, err => {
                        return res.status(400).json({
                            msg: err
                        })
                    })
                } else if (data.length > 0 && data[0].properties.permitted.value) {
                    return res.json({
                        msg: 'correspondence is permitted'
                    })
                } else if (data.length == 0) {
                    return res.status(404).json({
                        msg: 'correspondence not found'
                    })
                }
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

                var decoded = jwt.verify(req.query.token || req.body.token, KEY);

                if (!decoded)
                    return res.status(400).json({ err: 'invalid token' })

                function createMessage() {

                    var msgId = new mongoose.Types.ObjectId();
                    var messageTag = req.body.messageTag || shortid.generate();

                    var consumerToken = jwt.sign({ msgId: msgId, messageTag: messageTag, priv: 'redeem' }, KEY);

                    var computedResponses = {};

                    var url = req.protocol + '://' + (HOST || req.get('host')) + '/kju-dummy'

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
                            messageTag: {
                                type: "shortText",
                                value: messageTag
                            },
                            sender: {
                                type: "shortText",
                                value: decoded.contact
                            },
                            reciever: {
                                type: "longText",
                                value: req.body.reciever
                            },
                            consumerToken: {
                                type: "longText",
                                value: consumerToken
                            },
                            createdByHash: {
                                type: "shortText",
                                value: decoded.hash
                            }
                        }
                    }).add(data => {

                        var transportBody = req.body;

                        transportBody._id = data._id;
                        transportBody.responses = responsesToArray(data.properties.responses.properties);
                        transportBody.consumerToken = consumerToken;

                        if (options.transporter) options.transporter.transport(transportBody, (data) => {

                        });

                        res.json({
                            _id: msgId,
                            content: data.properties.content.value,
                            responses: responsesToArray(data.properties.responses.properties),
                            messageTag: data.properties.messageTag.value,
                            reciever: data.properties.reciever.value,
                            consumerToken: data.properties.consumerToken.value
                        })
                    }, err => {
                        res.status(400).json({ err: "an error occured" })
                    })
                }

                OBJY.correspondences({ "properties.sender.value": decoded.contact, "properties.reciever.value": req.body.reciever }).get(_data => {

                    console.log('dd', _data.length)

                    if (_data.length == 0) {
                        // Pass through one time
                        OBJY.correspondence({
                            properties: {
                                sender: {
                                    type: 'shortText',
                                    value: decoded.contact
                                },
                                reciever: {
                                    type: 'shortText',
                                    value: req.body.reciever
                                },
                                permitted: {
                                    type: 'boolean',
                                    value: false
                                }
                            }
                        }).add(data => {
                            createMessage()
                        }, err => {
                            res.status(400).json({ err: err })
                        })
                    } else if (_data.length >= 1) {
                        console.log('dfl', _data)
                        if (!_data[0].properties.permitted.value) {
                            // NOT YET PERMITTED!
                            return res.status(400).json({
                                msg: 'correspondence not yet permitted'
                            })
                        } else {
                            // OKAY
                            createMessage()
                        }

                    }

                })


            }, err => {
                res.status(400).json({ err: err })
            })


        });


    router.route('/message/:messageId')

        // get a single message
        .get(function(req, res) {

            var decoded = jwt.verify(req.query.token || req.body.token, KEY);

            console.log(decoded);

            if (!decoded || decoded.msgId != req.params.messageId)
                return res.status(400).json({ err: 'invalid token' })

            OBJY.message(req.params.messageId).get((data) => {

                if (decoded.messageTag != data.properties.messageTag.value)
                    return res.status(400).json({ err: 'not authorized' })

                res.json({
                    content: data.properties.content.value,
                    responses: responsesToArray(data.properties.responses.properties),
                    messageTag: data.properties.messageTag.value,
                    consumerToken: data.properties.consumerToken.value
                })
            }, err => {
                console.log(err)
                res.status(404).json({ err: "error getting message" })
            })
        })


        // delete a single message
        .delete(function(req, res) {

            var decoded = jwt.verify(req.query.token || req.body.token, KEY);

            console.log(decoded);

            if (!decoded)
                return res.status(400).json({ err: 'invalid token' })

            OBJY.message(req.params.messageId).get((data) => {

                if (data.properties.createdByHash.value != decoded.hash) {
                    return res.status(400).json({ err: 'not authorized' })
                }

                OBJY.message(req.params.messageId).remove((data) => {
                    res.json({
                        msg: 'ok'
                    })
                }, err => {
                    console.log(err)
                    res.status(404).json({ err: "error deleting message" })
                })

            }, err => {
                console.log(err)
                res.status(404).json({ err: "error getting message" })
            })
        });


    router.route('/ui/message/:messageId')

        // get a single message
        .get(function(req, res) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.send(`<html>

<head>
    <title>kju</title>
    <script src="https://cdn.jsdelivr.net/npm/vue"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/leto-css/leto/css/leto.min.css">
</head>

<body>
    <div class="leto-frame leto-height-full" id="app">
        <div class="leto-group leto-height-full leto-vertical-center leto-horizontal-center">
            <div class="" v-if="!redeemed">
                <div class="leto-text-xl leto-mb">
                    {{content}}
                </div>
                <div>
                    <div v-on:click="redeem('https://europe-west3-spoocloud-202009.cloudfunctions.net/kju-dummy/api/message/'+msgId+'/response/'+response.title+'?token='+token)" class="leto-button" v-for="response in responses">{{response.title}}</a>
                    </div>
                </div>
            </div>
            <div v-if="redeemed">
                <i>Response redeemed!</i>
            </div>
        </div>
        <center class="leto-text-sm leto-text-darker-grey">
            This is a kju message. Learn more <a href="https://kju-org.github.io">here</a>.
        </center>
    </div>
    <script>
    var app = new Vue({
        el: '#app',
        data: {
            redeemed: false,
            msgId: null,
            token: null,
            content: '',
            responses: []
        },
        methods: {
            redeem: function(url) {
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        this.redeemed = true;
                        localStorage.setItem(this.content, 'true')
                    });
            }
        },
        created: function() {

            var token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtc2dJZCI6IjVmNzE5MzA3ZjYyOTU0OTEyY2Y1N2I3MCIsIm1lc3NhZ2VUYWciOiI1RVZoMGdudXAiLCJwcml2IjoicmVkZWVtIiwiaWF0IjoxNjAxMjc4NzI3fQ.KzfHTR3Z3sR3sKNE_StL-cZvf3EKXCn_HJ-7Mykc0XA";

            var msgId = "5f719307f62954912cf57b70";
            this.msgId = msgId;
            this.token = token;

            fetch('https://europe-west3-spoocloud-202009.cloudfunctions.net/kju-dummy/api/message/' + msgId + '?token=' + token)
                .then(response => response.json())
                .then(data => {
                    document.title = data.content;
                    this.content = data.content;
                    this.responses = data.responses;

                    if (localStorage.getItem(this.content)) {
                        this.redeemed = true;
                        return;
                    }

                });
        }
    })
    </script>
</body>

</html>`)
        });


    router.route('/messages/:queryType')

        // get messages
        .get(function(req, res) {

            var decoded = jwt.verify(req.query.token || req.body.token, KEY);

            if (!decoded)
                return res.status(400).json({ err: 'invalid token' })

            switch (req.params.queryType) {

                case 'tag':

                    OBJY.messages({ "properties.messageTag.value": decoded.messageTag, $sort: '-created' }).get((data) => {

                        var arr = [];

                        data.forEach(function(d) {
                            arr.push({
                                _id: d._id,
                                created: d.created,
                                content: d.properties.content.value,
                                sender: (d.properties.sender || {}).value,
                                reciever: d.properties.reciever.value,
                                responses: responsesToArray(d.properties.responses.properties),
                                messageTag: d.properties.messageTag.value,
                                consumerToken: d.properties.consumerToken.value
                            })
                        })

                        res.json(arr);

                    }, err => {
                        console.log(err)
                        res.status(404).json({ err: "error getting message" })
                    })

                    break;

                case 'recieved':

                    OBJY.messages({ "properties.reciever.value": { $regex: decoded.contact, $options: "i" }, $page: req.query.$page || 1, $sort: '-created' }).get((data) => {

                        var arr = [];

                        data.forEach(function(d) {
                            arr.push({
                                _id: d._id,
                                created: d.created,
                                content: d.properties.content.value,
                                sender: (d.properties.sender || {}).value,
                                reciever: d.properties.reciever.value,
                                responses: responsesToArray(d.properties.responses.properties),
                                messageTag: d.properties.messageTag.value,
                                consumerToken: d.properties.consumerToken.value
                            })
                        })

                        res.json(arr);

                    }, err => {
                        console.log(err)
                        res.status(404).json({ err: "error getting message" })
                    })

                    break;
            }

        });


    router.route('/message/:messageId/responses')

        // get the responses for a message
        .get(function(req, res) {

            var decoded = jwt.verify(req.query.token || req.body.token, KEY);

            if (!decoded || decoded.msgId != req.params.messageId)
                return res.status(400).json({ err: 'invalid token' })

            OBJY.message(req.params.messageId).get((data) => {

                if (decoded.messageTag != data.properties.messageTag.value)
                    return res.status(400).json({ err: 'not authorized' })

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


    router.route(['/message/:messageId/response/:responseId', '/ui/message/:messageId/response/:responseId'])

        // redeem a response
        .get(function(req, res) {

            var decoded = jwt.verify(req.query.token || req.body.token, KEY);

            if (!decoded || decoded.msgId != req.params.messageId)
                return res.status(400).json({ err: 'invalid token' })

            OBJY.message(req.params.messageId).get((data) => {

                if (decoded.messageTag != data.properties.messageTag.value)
                    return res.status(400).json({ err: 'not authorized' })

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
                }).add(_data => {
                    if (req.originalUrl.includes('/ui/message/')) {

                        res.setHeader('Access-Control-Allow-Origin', '*');
                        res.send(`<html>
<head>
    <title>kju</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/leto-css/leto/css/leto.min.css">
</head>

<body>
    <div class="leto-frame leto-height-full" id="app">
        <div class="leto-group leto-row leto-height-full leto-vertical-center leto-horizontal-center">
            <div class="leto-display-block">
                <div class="leto-text-xl">${data.properties.content.value}</div>
                <br>
                <div class="leto-text-lg">
                    <i>- ${req.params.responseId}</i>
                </div>
                <br>
                <div class="leto-button" onclick="window.close();">close</div>
            </div>
           
        </div>
        <center class="leto-text-sm leto-text-darker-grey">
            This is a kju message. Learn more <a href="https://kju-org.github.io">here</a>.
        </center>
    </div>
</body>

</html>`);
                    } else {
                        res.json({
                            msg: "ok"
                        })
                    }

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