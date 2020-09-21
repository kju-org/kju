// kju server

/* NOTES

- access key (jwt) with privileges?
    - read message
    - redeem responses
    - see responses
- 

*/

const express = require('express');
const OBJY = require('objy');
var shortid = require('shortid');
var cors = require('cors');
var bodyParser = require('body-parser');
var moment = require("moment")

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

OBJY.client('public');
OBJY.app('kju');

OBJY.define({
    name: "message",
    pluralName: "mesages",
    //storage: {}, // MONGO
    //processor: {}, // BULLMQ
})

OBJY.define({
    name: "callLog",
    pluralName: "callLogs",
    //storage: {}, // MONGO
})




router.route('/creationToken')

    // get a token
    .post(function(req, res) {

    });

router.route('/message')

    // create a message
    .post(function(req, res) {

        /*
            {
                content: "",
                //id: "(autofilled),
                //ttl: "(autofilled)",
                // payload: "(optional sturcture. e.g. image, description, ...)",
                responses: [
                    {
                        //id: "(auto generated)",
                        title: "",
                        action: "(optional dsl)"
                    }
                ]"
            }
        */

        OBJY.message({
            name: req.body.content,
            _id: shortid.generate(),
            properties: {
                content: {
                    type: "longText",
                    value: req.body.content
                },
                ttl: {
                    type: "number",
                    value: req.body.ttl || 60000
                },
                responses: {
                    type: "bag",
                    properties: req.body.responses // TODO ARRAY TO OBJECT
                },
                superToken: { // full admin privileges for that message and corresponding responses
                    type: "longText",
                    value: "" // JWT
                },
                redeemToken: { // privilege for redeeming responses on that message
                    type: "longText",
                    value: "" // JWT
                },
                responsesToken: { // privilege for viewing responses for that message
                    type: "longText",
                    value: "" // JWT
                }
            }
        }).add(data => {
            res.json(data.properties)
        }, err => {
            res.status(400).json({ err: "an error occured" })
        })

    });


router.route('/message/:messageId')

    // get a single message
    .get(function(req, res) {

        OBJY.message(req.params.messageId).get((data) => {
            res.json(data);
        }, err => {
            console.log(err)
            res.status(404).json({ err: "error getting message" })
        })
    });

router.route('/message/:messageId/responses')

    // get the responses for a message
    .get(function(req, res) {

        OBJY.message(req.params.messageId).get((data) => {

            OBJY.callLogs({ name: req.params.messageId }).get(data => {
                /*
                    {
                        resId: {
                            title: "original title",
                            responses: [{
                                _id: "(from db)",
                                time: "(from db: created)",
                                content: "(from db: response content)"
                            }]
                        }
                    }
                */
            })

        }, err => {
            res.status(404).json({ err: "error getting message" })
        })
    });


router.route('/message/:messageId/response/:responseId')

    // redeem a response
    .get(function(req, res) {

        OBJY.message(req.params.messageId).get((data) => {

            var res = data.properties.responses[req.params.responseId];

            if (!res)
                return res.status(404).json({ err: "response not found" });

            // call action
            if (res.action)
                puzzle.parse(res.action);

            OBJY.callLog({
                // ...
            }).add(data => {

            }, err => {

            })

        }, err => {
            res.status(404).json({ err: "error getting message" })
        })

    });


app.listen(80);
app.use('/api', router);
console.log('server running');