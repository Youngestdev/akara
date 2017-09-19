
"use strict";

const {
    video,
    controls
} = require("../js/video_control.js");

const {
    remote: {
        dialog,
        Menu,
        MenuItem,
        getCurrentWindow,
        require: _require
    }
} = require("electron");


const {
    parse
} = require("url");

const {
    basename,
    join
} = require("path");

const {
    disableVideoMenuItem,
    __MenuInst,
    langDetect,
    getMime,
    validateMime,
    setupPlaying,
    readSubtitleFile,
    sendNotification
} = require("../js/util.js");


const {
    videoContextMenu
} = _require("./menu.js");

const {
    _enterfullscreen,
    _leavefullscreen
} = require("../js/handle_dropdown_commands.js")();

const akara_emit = require("../js/emitter.js");

const mime = require("mime");


/**
 *
 *
 * calls getHumanTime function
 *  the current time and duration section is updated frequently
 *  as video plays
 *
 *
 **/


const setTime = () => {

    const curTm = getHumanTime(controls.getCurrentTime());
    const durTm = getHumanTime(controls.duration());

    return `${curTm} / ${durTm}`;
};


module.exports.setTime = setTime;


/**
 *
 *
 * updateTimeIndicator is fired when timeupdate
 *  event listener is trigerred
 *
 * it calls setTime function to render the time
 *
 *
 **/


module.exports.updateTimeIndicator = () => {

    let timeIndicator = document.querySelector(".akara-time-current");
    const currTimeUpdate = document.querySelector(".akara-update-cur-time");

    const elapsed = Math.round((controls.getCurrentTime()).toFixed(1));
    const timeIndicatorWidth = ( elapsed * timeIndicator.parentNode.clientWidth) /
              ( controls.duration().toFixed(1));

    timeIndicator.setAttribute("style", `width: ${timeIndicatorWidth}px`);
    timeIndicator = undefined;
    currTimeUpdate.textContent = setTime();
    return true;

};



/**
 *
 *
 * jumpToClick, move the video indicator to
 * the position where mouse event is released
 *
 **/

const jumpToClick = (event,arg) => Math.
          round(controls.duration() * ((event.clientX - event.target.offsetLeft) / arg));


/**
 *
 *
 *
 *  handles the movement of the mouse arround the
 *    video length indicator
 *
 **/

const handleMovement = (event,cb) => {
    const incrDiv = document.querySelector(".akara-time-current");
    const result = jumpToClick(event,incrDiv.parentNode.clientWidth);
    return cb(result);
};




/**
 *
 *
 * removes the time that is shown
 * whenever the video length indicator is hovered on
 *
 **/


const removeHoverTime = () => {
    let isOverExists = document.querySelector("[data-hover=true]");

    if ( isOverExists ) {
        isOverExists.remove();
        isOverExists = undefined;
    }
    return ;
};

module.exports.removeHoverTime = removeHoverTime;



/**
 *
 *
 * converts the seconds returned by the video.duration and
 *   video.currentTime to human readable format
 *
 **/

const getHumanTime = result => isNaN(result)
          ? "00:00"
          : `${(result/60).toFixed(2)}`.replace(/\./, ":");




/**
 *
 *
 * show time whenever a section of the
 * video length indicator is hovered on
 *
 **/

const createHoverTime = ({event,result}) => {

    removeHoverTime();

    let target = event.target;

    const hoverIndication = document.createElement("div"),
          hoverStillVideo = document.createElement("video"),
          hoverTimeIndication = document.createElement("span"),
          hoveredLocationTime = getHumanTime(result);


    hoverIndication.append(hoverTimeIndication);

    target = target.classList.contains("akara-time-length") ? target : target.parentNode;

    hoverIndication.setAttribute("data-hover", "true");

    hoverTimeIndication.textContent = hoveredLocationTime;

    let left = event.clientX - event.target.getBoundingClientRect().left,
        top = event.clientY - event.target.getBoundingClientRect().top;

    hoverIndication.setAttribute("style", `left: ${left - 15}px; top: ${top - 25}px`);

    return target.parentNode.insertBefore(hoverIndication,target);

};



/**
 *
 *
 * mouse was held down and dragged
 *  set video length indicator to the location
 *  where mouse is no longer held down
 *
 *
 **/

const moveToDragedPos = event => handleMovement(event, result => {
    video.currentTime = result;
    createHoverTime({event,result});
});


module.exports.moveToDragedPos = moveToDragedPos;


/**
 *
 *
 * call any method of the control object
 * from data-fire
 *
 *
 **/

module.exports.fireControlButtonEvent = event => {

    ///////////////////////////////////////////////////////////
    // if ( ! video.src.length ) return dialog.showErrorBox( //
    //     "No Media", "No Media Source was found"           //
    // );                                                    //
    ///////////////////////////////////////////////////////////

    const target = event.target,
          nodeName = target.nodeName.toLowerCase();

    if ( nodeName !== "li" ) return ;

    if ( target.hasAttribute("data-fire") )
        controls[target.getAttribute("data-fire")](event);

    return ;
};



/**
 *
 * this function will be trigerred when video is in pause state
 *
 **/

module.exports.videoPauseEvent = () => {
    const play = document.querySelector("[data-fire=play]");
    const pause = document.querySelector("[data-fire=pause]");
    play.classList.remove("akara-display");
    return pause.classList.add("akara-display");
};



/**
 *
 *
 * sends notification is video is playing
 *  or resuming from a paused state
 *
 **/
const __checkPlayStateAndNotify = () => {

    if ( video.__status === "paused" ) {
        video.__status = undefined;
        return sendNotification("Resuming", {
            body: decodeURIComponent(basename(parse(video.src).path))
        });
    }
    return sendNotification("Now Playing", {
        body: decodeURIComponent(basename(parse(video.src).path))
    });

};




/**
 *
 *
 * handle play event when the video
 *  is just played
 *
 **/

module.exports.videoPlayEvent = () => {

    const play = document.querySelector("[data-fire=play]");
    const pause = document.querySelector("[data-fire=pause]");
    const notify = __checkPlayStateAndNotify();

    pause.classList.remove("akara-display");

    localStorage.setItem("currplaying", video.src);

    return play.classList.add("akara-display");
};



/**
 *
 * videoLoadedEvent is trigerred whenever
 *  a playlist video is loaded in the video section
 *
 **/

module.exports.videoLoadedEvent = () => {
    const currentVolumeSet = document.querySelectorAll("[data-volume-set=true]");
    const coverOnError = document.querySelector(".cover-on-error-src");

    video.volume = currentVolumeSet[currentVolumeSet.length - 1].getAttribute("data-volume-controler");

    if ( coverOnError )
        coverOnError.setAttribute("style", "display: none;");
};




/**
 *
 * disableControls when there is no media file
 *
 **/

const disableControls = () => {
    const currTimeUpdate = document.querySelector(".akara-update-cur-time");
    currTimeUpdate.innerHTML = "00:00 / 00:00";
    document.querySelector(".cover-on-error-src").removeAttribute("style");
    return video.removeAttribute("src");
};

/**
 *
 * during conversion start to
 * play next video or previous video
 *
 * the controls object is use
 * since we do not want to fire
 * __splitError in handle_droped_commands.js
 * because video.getAttribute("src") is assumed
 *    to be false whenever this function is hit
 * by calling the _next function
 *
 **/

const playNextOrPrev = () => {
    const akaraLoaded = document.querySelector(".akara-loaded");
    const playlistItem = akaraLoaded.querySelector(`#${video.getAttribute("data-id")}`);
    // ask user if to play next or
    // previous video or not at all

    if ( ! playlistItem ) return disableControls();

    if ( playlistItem.nextElementSibling ) {
        return controls.next();
    } else if (playlistItem.previousElementSibling ) {
        return controls.previous();
    } else {
        return disableControls();
    }
};


module.exports.playNextOrPrev = playNextOrPrev;

/**
 *
 *
 *
 * videoErrorEvent is fired, when there is an error
 *  in playing the video
 *
 *
 **/

module.exports.videoErrorEvent = async () => {

    const _src = video.getAttribute("src").replace("file://","");
    const akaraLoaded = document.querySelector(".akara-loaded");
    const playlistItem = akaraLoaded.querySelector(`#${video.getAttribute("data-id")}`);

    // as soon as an error occur
    // disable the controls

    disableControls();



    const isMedia = await getMime(_src);


    /**
     *
     * handle bug when all playlist is remove
     * form the playlist section
     *
     **/

    if ( /^\s{0,}$/.test(_src) ) {
        return playNextOrPrev();
    }



    /**
     *
     * if media is neither an audio or vdieo
     *
     **/
    if ( ! /^audio|^video/.test(isMedia) ) {
        dialog.showErrorBox("Invalid file",`Cannot Play ${basename(_src)}`);
        return playNextOrPrev();
    }


    // possibly the codec or mime is not supported
    // show a message to the user to convert the file or not

    const btn = dialog.showMessageBox({
        type: "error",
        title: "Invalid stream",
        buttons: [ "Cancel", "Convert" ],
        message: `${basename(_src)} is not valid. Would you like to convert it ?`
    });



    /**
     *
     * 0 is first button which is cancel
     *
     **/

    if ( btn === 0 ) return playNextOrPrev();


    // btn is 1

    playNextOrPrev();

    // start conversion
    const path = await validateMime(_src);


    if ( ! path ) {
        disableControls();
        return dialog.showErrorBox(
            "Cannot convert media file",`${_src} was not converted`
        );
    }

    playlistItem.setAttribute("data-full-path", path);

    // CONFIGURATION:- play converted video automatically
    //     or NOT
    setupPlaying(playlistItem);
};



/**
 *
 *
 * jump current time indicator to selected time
 *  by the user in the time indicator
 *
 **/

module.exports.clickedMoveToEvent = event => {
    const target = event.target;
    if ( target.classList.contains("akara-time-length")
         || target.classList.contains("akara-time-current") ) {
        return handleMovement(event, result => video.currentTime = result);
    }
    return false;
};




/**
 *
 *
 * show time when video length indicator is hovered on
 *
 **/

module.exports.mouseMoveShowCurrentTimeEvent = event => {

    let target = event.target;

    if ( target.classList.contains("akara-time-length")
         || target.classList.contains("akara-time-current") ) {

        let isOverExists = document.querySelector("[data-hover=true]");
        if ( isOverExists ) {
            isOverExists.remove();
            isOverExists = undefined;
        }
        return handleMovement(event, result => createHoverTime({event,result}) );
    }
    return false;
};



/**
 *
 *
 * mouseDownDragevent is fired when the mouse is held down and dragged
 *
 *
 **/

module.exports.mouseDownDragEvent = event => {

    const jumpToSeekElement = document.querySelector(".akara-time");

    return event.target.classList.contains("akara-time-current")
        ? jumpToSeekElement.addEventListener("mousemove", moveToDragedPos)
        : false;
};




/**
 *
 *
 * if the volume icon is in mute state
 * unmute the video
 *
 **/

const __removeRedMute = () => {
    const changeVolumeIcon = document.querySelector("[data-fire=volume]");
    if ( video.muted ) {
        changeVolumeIcon.setAttribute("style", "color: red;");
        controls.unmute();
    } else {
        changeVolumeIcon.removeAttribute("style");
    }
};



/**
 *
 *
 * onmousewheel update the volume
 *
 *
 **/

module.exports.handleVolumeWheelChange = event => {

    const scrollPos = event.wheelDeltaY,
          decimalVol = scrollPos / 100,
          volumeElements = Array.prototype.slice.call(document.querySelectorAll("[data-volume-set=true]"));

    let popedValue;

    __removeRedMute();

    if ( (Math.sign(decimalVol) === -1 )
         && ( popedValue = volumeElements.pop() )
         && ( volumeElements.length >= 1 ) )
    {

        popedValue.removeAttribute("data-volume-set");
        video.volume = volumeElements[volumeElements.length - 1].getAttribute("data-volume-controler");
    }


    if ( Math.sign(decimalVol) === 1 ) {

        const nextElementFromArray = volumeElements[volumeElements.length - 1].nextElementSibling;

        if ( nextElementFromArray ) {
            nextElementFromArray.setAttribute("data-volume-set", "true");
            video.volume = nextElementFromArray.getAttribute("data-volume-controler");
        }
    }
    // to enable the showing of fa-volume-down
    return akara_emit.emit("video::volume", video.volume);

};





/**
 *
 * change volume when the volume indiciators
 *   are clicked on
 *
 **/
module.exports.handleVolumeChange = event => {

    const target = event.target;

    let isChanged = 0;

    if ( target.nodeName.toLowerCase() !== "span" ) return false;

    target.setAttribute("data-volume-set", "true");

    video.volume = target.getAttribute("data-volume-controler");

    __removeRedMute();

    let _NextTarget = target.nextElementSibling;
    let _PrevTarget = target.previousElementSibling;

    while ( _NextTarget ) {
        _NextTarget.removeAttribute("data-volume-set");
        _NextTarget = _NextTarget.nextElementSibling;
    }

    while ( _PrevTarget ) {
        _PrevTarget.setAttribute("data-volume-set", "true");
        _PrevTarget = _PrevTarget.previousElementSibling;
    }


    akara_emit.emit("video::volume", video.volume);
    return true;
};



/**
 *
 *
 * setup track element with necessary attributes
 *
 **/
const setUpTrackElement = async (path,fileLang) => {
    const __tracks = video.querySelectorAll("track");
    const track = document.createElement("track");
    const subtitle = path;

    fileLang = fileLang || await langDetect(path);

    let lang = fileLang ? fileLang : `No Lang ${basename(path).substr(0, 7)}`;

    track.setAttribute("src", subtitle);
    track.setAttribute("label", lang);
    track.setAttribute("srclang", lang);
    track.setAttribute("kind", "subtitles");

    // set the id of tracks from 0 1 2 3 ... n
    track.setAttribute("id", __tracks.length === 0 ? __tracks.length : (__tracks.length - 1) + 1);

    return { track, lang };
};



/**
 *
 *
 *
 * add subtitle to the list of subtitles
 *  in the menu
 *
 **/
module.exports.handleLoadSubtitle = async (path,cb) => {

    if ( ! path ) return ;



    /**
     *
     * from computer the return value is an array
     * from internet it's just a string
     *
     **/

    [ path ] = Array.isArray(path) ? path : [ path ];


    if ( /x-subrip$/.test(mime.lookup(path)) )
        path = await cb(path);

    const { track, lang } = await setUpTrackElement(path);

    sendNotification("Subtitle", {
        body: "Subtitle have been successfully added"
    });

    video.appendChild(track);

    const { submenu } = videoContextMenu[16].submenu[1];

    submenu.push({
        label: lang,
        click(menuItem) {
            // send the current pushed object to video::show_subtitle event
            //  the label value of menuItem will be used
            //  to determine the textTracks language
            akara_emit.emit("video::show_subtitle",menuItem,submenu.length - 1);
        },
        accelerator: `CommandOrCtrl+${track.getAttribute("id")}`,
        type: "radio",
        checked: false
    });

    Object.assign(videoContextMenu[16].submenu[1], {
        submenu
    });
};



/**
 *
 * loaddata event handler
 *
 **/


module.exports.videoLoadData = event => {

    const currTimeUpdate = document.querySelector(".akara-update-cur-time");

    currTimeUpdate.textContent = setTime();

    const submenu = videoContextMenu[16].submenu;

    // no need to remove if no subtitle was added in previous video
    if ( submenu ) {
        Object.assign(videoContextMenu[16].submenu[1],{
            submenu: []
        });
        Array.from(document.querySelectorAll("track"), el => {
            el.remove();
        });
    }

}


module.exports.mouseHoverOnVideo = () => {
    const akaraControl = document.querySelector(".akara-control");
    if ( ! document.webkitIsFullScreen )
        return false;
    return akaraControl.removeAttribute("hidden");
};



// FIX-ME
module.exports.mouseNotHoverVideo = () => {

    const akaraControl = document.querySelector(".akara-control");

    if ( ! document.webkitIsFullScreen )
        return false;

    setTimeout( () => {
        akaraControl.setAttribute("hidden", "true");
    },3000);

    akaraControl.animate({
        opacity: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]
    },3000);
};

module.exports.contextMenuEvent = () => {

    let menu = new Menu();

    let vidMenuInst ;

    menu.clear();
    console.log(menu);
    videoContextMenu.forEach( _menu => {
        vidMenuInst = new MenuItem(_menu);
        disableVideoMenuItem(vidMenuInst);
        menu.append(vidMenuInst);
    });

    menu.popup(getCurrentWindow(), { async: true });
};

module.exports.lowHighVolume = volume => {

    const changeVolumeIcon = document.querySelector("[data-fire=volume]");
    let type;

    if ( volume && ( type = volume <= 0.3 ? "down" : "up") ) {

        changeVolumeIcon.classList.remove(`fa-volume-${ type === "down" ? "up" : type }`);
        changeVolumeIcon.classList.add(`fa-volume-${type}`);
    }

    if ( ! volume  || video.muted )
        changeVolumeIcon.setAttribute("style", "color: red");
    else
        changeVolumeIcon.removeAttribute("style");

};

const dbClickEvent = () => {

    if ( document.webkitIsFullScreen )
        return _leavefullscreen();
    else
        return _enterfullscreen();
};

module.exports.dbClickEvent = dbClickEvent;


module.exports.showSubtitle = (mItem,id) => {

    const textTracks = video.textTracks;

    const { length: _textTrackLength } = textTracks;

    const { submenu } = videoContextMenu[16].submenu[1];

    for ( let i = 0; i < _textTrackLength; i++ ) {

        if ( mItem.label === textTracks[i].label ) {
            textTracks[i].mode = "showing";
            continue;
        }

        textTracks[i].mode = "hidden";

        // disable text track from radio checked state to false
        //   for some reason electron does not do this
        Object.assign(submenu[textTracks[i].id], {
            checked: false
        });

        Object.assign(videoContextMenu[16].submenu[1], {
            submenu
        });
    }

    Object.assign(submenu[id], {
        checked: true
    });
};
