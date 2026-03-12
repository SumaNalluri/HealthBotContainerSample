const defaultLocale = 'en-US';

function requestChatBot(loc) {
    const params = new URLSearchParams(location.search);
    const oReq = new XMLHttpRequest();
    oReq.addEventListener("load", initBotConversation);

    var path = "/chatBot?locale=" + extractLocale(params.get('locale'));

    if (loc) {
        path += "&lat=" + loc.lat + "&long=" + loc.long;
    }

    if (params.has('userId')) {
        path += "&userId=" + params.get('userId');
    }

    if (params.has('userName')) {
        path += "&userName=" + params.get('userName');
    }

    oReq.open("POST", path);
    oReq.send();
}

function extractLocale(localeParam) {
    if (!localeParam) {
        return defaultLocale;
    }
    else if (localeParam === 'autodetect') {
        return navigator.language;
    }
    else {
        return localeParam;
    }
}

function chatRequested() {
    const params = new URLSearchParams(location.search);

    if (params.has('shareLocation')) {
        getUserLocation(requestChatBot);
    }
    else {
        requestChatBot();
    }
}

function getUserLocation(callback) {
    navigator.geolocation.getCurrentPosition(
        function(position) {
            var location = {
                lat: position.coords.latitude,
                long: position.coords.longitude
            };
            callback(location);
        },
        function(error) {
            console.log("location error:" + error.message);
            callback();
        });
}

function initBotConversation() {

    if (this.status >= 400) {
        alert(this.statusText);
        return;
    }

    const jsonWebToken = this.response;
    const tokenPayload = JSON.parse(atob(jsonWebToken.split('.')[1]));

    const user = {
        id: tokenPayload.userId,
        name: tokenPayload.userName,
        locale: tokenPayload.locale
    };

    let domain = undefined;

    if (tokenPayload.directLineURI) {
        domain = "https://" + tokenPayload.directLineURI + "/v3/directline";
    }

    let location = undefined;

    if (tokenPayload.location) {
        location = tokenPayload.location;
    }

    var botConnection = window.WebChat.createDirectLine({
        token: tokenPayload.connectorToken,
        domain: domain
    });

    const styleOptions = {
        botAvatarImage: 'https://docs.microsoft.com/en-us/azure/bot-service/v4sdk/media/logo_bot.svg?view=azure-bot-service-4.0',
        botAvatarInitials: 'Bot',
        userAvatarInitials: 'You',
        hideSendBox: false,
        backgroundColor: '#F8F8F8'
    };

    const store = window.WebChat.createStore({}, function(store) {
        return function(next) {
            return function(action) {

                if (action.type === 'DIRECT_LINE/CONNECT_FULFILLED') {

                    setTimeout(() => {

                        store.dispatch({
                            type: 'DIRECT_LINE/POST_ACTIVITY',
                            meta: { method: 'keyboard' },
                            payload: {
                                activity: {
                                    type: "event",
                                    name: "InitConversation",
                                    from: { id: user.id, name: user.name },
                                    locale: user.locale,
                                    value: {
                                        jsonWebToken: jsonWebToken
                                    }
                                }
                            }
                        });

                    }, 1000); // Delay fixes startup error
                }

                else if (
                    action.type === 'DIRECT_LINE/INCOMING_ACTIVITY' &&
                    action.payload &&
                    action.payload.activity &&
                    action.payload.activity.type === "event" &&
                    action.payload.activity.name === "ShareLocationEvent"
                ) {

                    getUserLocation(function (location) {
                        store.dispatch({
                            type: 'WEB_CHAT/SEND_POST_BACK',
                            payload: { value: JSON.stringify(location) }
                        });
                    });
                }

                return next(action);
            }
        }
    });

    const webchatOptions = {
        directLine: botConnection,
        styleOptions: styleOptions,
        store: store,
        userID: user.id,
        username: user.name,
        locale: user.locale
    };

    startChat(user, webchatOptions);
}

function startChat(user, webchatOptions) {
    const botContainer = document.getElementById('webchat');
    window.WebChat.renderWebChat(webchatOptions, botContainer);
}
