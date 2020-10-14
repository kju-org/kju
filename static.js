const static = {
	singleMessage: `<html>
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
</html>`,
}