"use strict";

const { request } = require("http");

const akara_emit = require("../js/emitter.js");

const {
    remote: {
        require: _require,
        BrowserWindow
    },
    ipcRenderer: ipc
} = require("electron");

const {
    CONVERTED_MEDIA,
    URL_ONLINE,
    DOWNLOADED_SUBTITLE,
    SIZE,
    MEASUREMENT
} = _require("./constants.js");

const {
    Magic,
    MAGIC_MIME_TYPE: _GET_MIME
} = require("mmmagic");

const _OS = require("opensubtitles-api");

const url = require("url");

const { spawn } = require("child_process");

const {
    mkdirSync ,
    existsSync,
    readFileSync
} = require("fs");

const {
    join,
    basename,
    parse
} = require("path");

const { video, controls: { play } } = require("../js/video_control.js");

const OS = new _OS("OSTestUserAgentTemp");

const { guessLanguage } = require("guesslanguage");

const magic = new Magic(_GET_MIME);

// get the main window only
const win = BrowserWindow.fromId(1);

const createEl = ({path: abs_path, _path: rel_path}) => {

    let lengthOfSib = document.querySelector(".akara-loaded").childElementCount;

    const child = document.createElement("li");
    const childchild = document.createElement("span");
    // nonsence
    //abs_path = URL.createObjectURL( new File([ dirname(abs_path) ] , basename(abs_path)) );
    child.setAttribute("data-full-path", url.format({
        protocol: "file",
        slashes: "/",
        pathname: abs_path
    }));

    child.setAttribute("id", `_${lengthOfSib++}`);

    child.classList.add("playlist");
    childchild.textContent = rel_path;
    child.appendChild(childchild);

    return child;
};
const removeType = (pNode,...types) => {
    Array.from(pNode.children, el => {
        types.forEach( type => el.hasAttribute(type)
            ? el.removeAttribute(type)
            : "");
    });
};
const removeClass = (target, ...types) => {
    Array.from(target.parentNode.children, el => {
        for ( let i of types ) {
            if ( el.classList.contains(i) ) el.classList.remove(i);
        }
    });
};
const setCurrentPlaying = target => {
    target.setAttribute("data-dbclicked", "true");
    target.setAttribute("data-now-playing", "true");
    target.setAttribute("data-clicked", "true");
    target.classList.add("fa");
    target.classList.add("fa-play-circle");
    document.querySelector(".akara-title").textContent = target.querySelector("span").textContent;
    return ;
};
const RESETTARGET = target => target.nodeName.toLowerCase() === "li" ? target : target.parentNode;
const removeTarget = (target,video) => {
    target = RESETTARGET(target);

    if ( decodeURI(video.src) === target.getAttribute("data-full-path") ) {

        let _target = target.nextElementSibling || target.parentNode.firstElementChild;

        if ( _target.parentNode.childElementCount === 1 ) {

            video.src = "";

            const play = document.querySelector("[data-fire=play]");

            const pause = document.querySelector("[data-fire=pause]");

            pause.classList.add("akara-display");

            play.classList.remove("akara-display");

            document.querySelector(".akara-title").textContent = "Akara Media Player";

        } else {
            video.src = _target.getAttribute("data-full-path");
            setCurrentPlaying(_target);
            video.play();
        }
    }
    target.remove();
    target = undefined;
    return ;
};
const __disable = (item,menuObject) => {
    if (  item === menuObject.label ) {
        menuObject.enabled = false;
    }
};
const disableMenuItem = (memItem,target,video) => {

    // if the label is play and the video is not paused
    // disable the label
    if ( memItem.label === "Play" && target.hasAttribute("data-now-playing") && ! video.paused)
        memItem.enabled = false;

    // if the label is pause and the video is paused
    // disable the label
    if ( memItem.label === "Pause" && target.hasAttribute("data-now-playing") && video.paused )
        memItem.enabled = false;

    // label is pause
    // but the target is not currently been played , disabled the label
    if ( memItem.label === "Pause" && ! target.hasAttribute("data-now-playing") )
        memItem.enabled = false;

    if ( memItem.label === "Repeat" && target.hasAttribute("data-repeat") )
        memItem.visible = false;

    if ( memItem.label === "No Repeat" && ! target.hasAttribute("data-repeat") )
        memItem.visible = false;


    if ( memItem.label === "Repeat All" && target.parentNode.hasAttribute("data-repeat") )
        memItem.visible = false;

    if ( memItem.label === "No Repeat All" && ! target.parentNode.hasAttribute("data-repeat") )
        memItem.visible = false;
};

const setupPlaying = target => {
    removeClass(target,"fa","fa-play-circle");
    removeType(target.parentNode,"data-dbclicked","data-now-playing","data-clicked");
    setCurrentPlaying(target);
    video.setAttribute("data-id", target.getAttribute("id"));
    video.setAttribute("src", target.getAttribute("data-full-path"));
    return play();
};

const prevNext = moveTo => {
    let target = document.querySelector("[data-now-playing=true]");

    if ( moveTo === "next" && target.nextElementSibling ) {
        return setupPlaying(target.nextElementSibling);
    }
    if ( moveTo === "prev" && target.previousElementSibling )
        return setupPlaying(target.previousElementSibling);
};

const createDir = () => mkdirSync(`${CONVERTED_MEDIA}`);

const sendNotice = message =>  new Notification(message);

const getMime = file => new Promise((resolve,reject) => {
    magic.detectFile(file, (err,data) => {
        if ( err) return reject(err);
        return resolve(data);
    });
});
const validateMime = async (path) => {

    const _getMime = await getMime(path);

    if ( ! /^audio|^video/.test(_getMime) ) return undefined;

    const canPlay = video.canPlayType(_getMime);

    if ( /^maybe$|^probably$/.test(canPlay) ) return path;

    sendNotice("Unsupported Mime/Codec detected, this file will be converted in the background");
    let _fpath;

    try {
        _fpath = await Convert(path);
    } catch(ex) {
        _fpath = ex;
    }

    if ( Error[Symbol.hasInstance](_fpath) )
        path = undefined;
    else
        path = _fpath;
    return path;
};
const Convert = _path => new Promise((resolve,reject) => {
    let result;

    // _fpath will contain the converted path
    const _fpath = join(CONVERTED_MEDIA,parse(_path).name + ".mp4");

    if ( ! existsSync(CONVERTED_MEDIA) )
        createDir();

    // if _fpath exists instead just resolve don't convert
    if ( existsSync(_fpath) ) {
        return resolve(_fpath);
    }

    const ffmpeg = spawn("ffmpeg", ["-i", _path , "-acodec", "libmp3lame", "-vcodec", "mpeg4", "-f", "mp4", _fpath]);

    ffmpeg.stderr.on("data", data => {});

    ffmpeg.on("close", code => {
        if ( code >= 1 )
            reject(new Error("Unable to Convert Video"));
        resolve(_fpath);
    });
});
const playOnDrop = () => {
    const firstVideoList = document.querySelector(".playlist");
    if ( ! video.getAttribute("src") ) {
        return setupPlaying(firstVideoList);
    }
};
const disableVideoMenuItem = menuInst => {

    if  ( ! video.hasAttribute("src") && menuInst.label !== "Add" )
        return(menuInst.enabled = false);

    if ( menuInst.label === "Play" && ! video.paused )
        return(menuInst.enabled = false);

    if ( menuInst.label === "Pause" && video.paused )
        return(menuInst.enabled = false);

    if ( menuInst.label === "Repeat" && video.hasAttribute("loop") )
        return(menuInst.visible = false);

    if ( menuInst.label === "No Repeat" && video.hasAttribute("loop") )
        return(menuInst.visible = true);

    if ( menuInst.label === "Subtitle" && ! navigator.onLine) {
        // optimize this code later
        return(__MenuInst(menuInst, "Load Subtitle", "From Net").enabled = false);
    }

    if ( menuInst.label === "Enter FullScreen" && win.isFullScreen() )
        return(menuInst.visible = false);

    if ( menuInst.label === "Leave FullScreen" && win.isFullScreen() )
        return(menuInst.visible = true);

};
const __MenuInst = ( menu, match, submatch) => {
    let menuInst;
    for ( let _items of menu.items || menu.submenu.items ) {

        if ( _items.label === match && ! _items.__priv ) {
            // match is not neccessary here,
            //  since it's recurse function
            return __MenuInst(_items,match,submatch);
        }
        if ( _items.label === submatch && _items.__priv ) {
            menuInst = _items;
            break;
        }
    }
    return menuInst;
};

const langDetect = (file) => {
    return new Promise((resolve,reject) => {
        guessLanguage.name(readFileSync(file).toString(), info => {
            resolve(info);
        });
    });
};

const checkValues = ({input,movie,series,season,episode}) => {
    if ( input.value.length === 0 ) {
        return "TEXT_LENGTH_GREAT";
    }
    if ( series.checked ) {
        if ( isNaN(season.value) || season.value.length === 0 ) {
            return "SEASON_INVALID";
        }
        if ( isNaN(episode.value) || episode.value.length === 0 )  {
            return "EPISODE_INVALID";
        }
        const query = input.value;
        season = season.value;
        episode = episode.value;
        return { query, season, episode };
    }
    if ( input.value.length > 0 &&
         ! series.checked && ! movie.checked ) {
        return "SERIES_MOVIE_NO_CHECKED";
    }
    if ( movie.checked ) {
        const query = input.value;
        return { query };
    }
};

const GetSubTitle = async (option) => {
    console.log(option);
    let value;
    try {
        value = await OS.search(option);
    } catch(ex) {
        value = ex;
    }
    return value;
};

const StyleResult = value => {
    console.log(value);
};

let INTERVAL_COUNT = 0;

const intervalId = (loaded) => {

    const intId = setInterval( () => {
        console.log(INTERVAL_COUNT);
        if ( loaded.getAttribute("hidden") ) return clearInterval(intId);

        if ( INTERVAL_COUNT === 30 ) {

            loaded.innerHTML = "Connection is taking too long";

        } else if ( INTERVAL_COUNT === 60 ) {

            loaded.innerHTML = "Giving Up. Check Your Internet Speed";

            clearInterval(intId);

            INTERVAL_COUNT = 0;

        } else {

            INTERVAL_COUNT++;

        }

    },5000);

    return intId;
};
const ErrorCheck = (err,loaded) => {
    INTERVAL_COUNT = 0;
    if ( Error[Symbol.hasInstance](err) ) {
        loaded.innerHTML = "Cannot connect to subtitle server";
        return true;
    }
    return false;
};

module.exports = {
    createEl,
    removeTarget,
    removeClass,
    removeType,
    setCurrentPlaying,
    disableMenuItem,
    setupPlaying,
    prevNext,
    validateMime,
    playOnDrop,
    disableVideoMenuItem,
    __MenuInst,
    langDetect,
    getMime,
    checkValues,
    GetSubTitle,
    StyleResult,
    intervalId,
    ErrorCheck,
    isOnline
};
