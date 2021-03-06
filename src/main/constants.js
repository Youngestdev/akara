"use strict";
const {
    join,
    basename
} = require("path");

const {
    app
} = require("electron");

const {
    existsSync,
    mkdirSync,
    writeFileSync
} = require("fs");

const jsonFileDB = require("./defaultSettings.js");


const APP_PATH = app.getAppPath();
const BACKGROUND_COLOR = "#4B4B4B";
const USER_DATA = app.getPath("userData");

const PLAYLIST_FILE = () => {

    const playlistfile = join(USER_DATA, "playlist.json");

    if ( existsSync(playlistfile) )
        return playlistfile;

    writeFileSync(playlistfile, JSON.stringify({}));

    return playlistfile;
};

const _CONVERTED_MEDIA = () => {
    const _conv = join(USER_DATA, "converted_media");

    if ( existsSync(_conv) )
        return _conv;

    mkdirSync(_conv);

    return _conv;
};

const PODCAST = () => {
    const pod = join(USER_DATA, "podcast.json");
    if ( existsSync(pod) )
        return pod;

    writeFileSync(pod, JSON.stringify({}));
    return pod;
};

const requireSettingsPath = type => {

    const settingsPath = SETTINGS();
    const jsonPath = join(settingsPath, type);

    if ( existsSync(jsonPath) )
        return jsonPath;

    let objConfig = jsonFileDB[type.replace(".json","")];

    if ( ! objConfig )
        objConfig = {};

    writeFileSync(jsonPath, JSON.stringify(objConfig));

    return jsonPath;
};

const SETTINGS = () => {

    const settings = join(USER_DATA, "settings");

    if ( existsSync(settings) )
        return settings;

    mkdirSync(settings);
    return settings;
};

const USER_POSTERS_LOCATION = () => {
    const posters = join(USER_DATA, "posters");

    if ( existsSync(posters) )
        return posters;

    mkdirSync(posters);
    return posters;
};

const _CURRENT_TIME = () => {

    const currenttime = join(USER_DATA, "currenttime");

    if ( existsSync(currenttime) )
        return currenttime;

    mkdirSync(currenttime);

    return currenttime;
};


( () => {
    if ( existsSync(USER_DATA) )
        return ;
    mkdirSync(USER_DATA);
})();
const CONVERTED_MEDIA = _CONVERTED_MEDIA();
const DOWNLOADED_SUBTITLE = join(USER_DATA, "subtitle");
const CURRENT_TIME = _CURRENT_TIME();
const URL_ONLINE = "icanhazip.com/";
const SIZE = 1000;
const MEASUREMENT = [ "Bytes", "kB", "MB", "GB", "TB" ];
const TWITTER_OAUTH = "https://api.twitter.com/oauth/authenticate";
const FFMPEG_LOCATION = `${APP_PATH}/node_modules/.bin/`;


/*const BYTE = 8;
const MBYTE = 1048576;
const GBYTE = 1073741824;
const TBYTE = 1099511627776;
*/

module.exports = {
    CONVERTED_MEDIA,
    CURRENT_TIME,
    APP_PATH,
    BACKGROUND_COLOR,
    URL_ONLINE,
    DOWNLOADED_SUBTITLE,
    SIZE,
    MEASUREMENT,
    PLAYLIST_FILE,
    TWITTER_OAUTH,
    PODCAST,
    FFMPEG_LOCATION,
    requireSettingsPath,
    USER_POSTERS_LOCATION
};
