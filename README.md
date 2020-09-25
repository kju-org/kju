# kju - open communication framework

kju is an open and simple communication framework that works on a `request <-> response` pattern. 

* Any participator can create a request with a number of predefined responses.
* Any participator can redeem a response for a given request

> For detailed usage instructions, see the official [Documentation](https://kju-org.github.io)

# Get started

1. install via npm:

```shell
npm i kju --save
```

2. run it with node:

```shell
node index.js
// Running kju server on port 80
```

This will spin up your kju server

# API

Your kju server will offer the following REST Endpints:


* `POST /creationToken` - Generate a token for creating messages
* `POST /message?token=XXX` - Create a message
* `GET /message/:messageId?token=XXX` - Get a raw message
* `GET /message/:messageId/response/:responseId?token=XXX` - Redeem a response
* `GET /message/:messageId/responses?token=XXX` - Get all responses for a message


The following two API Endpoints can also be opened int he browser. kju will then render them with a tiny UI.

* `/message/:messageId?token=XXX` 

* `/message/:messageId/responses?token=XXX` 
