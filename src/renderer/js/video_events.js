const { video,
        controls,
        videoEmit
      } = require("../js/video_control.js");
const {
    disableVideoMenuItem,
    __MenuInst,
    langDetect
} = require("../js/util.js");

const { parse } = require("url");
const { basename } = require("path");
const { remote:
        { dialog,
          require: _require,
          Menu,
          MenuItem,
          getCurrentWindow,
          BrowserWindow,
          shell: {
              showItemInFolder
          }
        }, ipcRenderer: ipc
      } = require("electron");

const { addMediaFile,
        addMediaFolder,
        _play,
        _stop,
        _pause,
        _next,
        _previous,
        _setPlaybackRate,
        _enterfullscreen,
        _leavefullscreen
      } = require("../js/handle_dropdown_commands.js")();


const { videoContextMenu } = _require("./menu.js");

const currTimeUpdate = document.querySelector(".akara-update-cur-time"),
      jumpToSeekElement = document.querySelector(".akara-time"),
      akaraVolume = document.querySelector(".akara-volume"),
      changeVolumeIcon = document.querySelector("[data-fire=volume]"),
      akaraControl = document.querySelector(".akara-control"),
      controlElements = akaraControl.querySelector(".akara-control-element");




const menu = new Menu();

// the first window, this had to be hadcoded
const win = BrowserWindow.fromId(1);

const textTracks = video.textTracks;


(() => {
    for ( let j = 0; j < textTracks.lenght; j++ ) {
        textTracks[j].addEventListener("cuechange", (e) => {
            console.log(e.activeCues);;
        });
    }
})();

const updateTimeIndicator = () => {

    let timeIndicator = document.querySelector(".akara-time-current");
    const currTimeUpdate = document.querySelector(".akara-update-cur-time");

    const elapsed = Math.round((controls.getCurrentTime()).toFixed(1));
    const timeIndicatorWidth = ( elapsed * timeIndicator.parentNode.clientWidth) /
              ( controls.duration().toFixed(1));

    timeIndicator.setAttribute("style", `width: ${timeIndicatorWidth}px`);

    timeIndicator = undefined;

    currTimeUpdate.textContent = `${getHumanTime(controls.getCurrentTime())} / ${getHumanTime(controls.duration())}`;

    return true;
};


const sendNotification = (title,message) => new Notification(title,message);

const jumpToClick = (event,arg) => Math.
          round(controls.duration() * ((event.clientX - event.target.offsetLeft) / arg));

const handleMovement = (event,cb) => {

    const incrDiv = document.querySelector(".akara-time-current");
    const result = jumpToClick(event,incrDiv.parentNode.clientWidth);

    return cb(result);
};

const removeHoverTime = () => {

    let isOverExists = document.querySelector("[data-hover=true]");

    if ( isOverExists ) {
        isOverExists.remove();
        isOverExists = undefined;
    }
    return ;
};

const getHumanTime = result => `${(result/60).toFixed(2)}`.replace(/\./, ":");

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


const moveToDragedPos = event => handleMovement(event, result => {
    video.currentTime = result;
    createHoverTime({event,result});
});

const fireControlButtonEvent = event => {

    if ( ! video.src.length )

        return dialog.showErrorBox("No Media", "No Media Source was found");


    const target = event.target,
          nodeName = target.nodeName.toLowerCase();

    if ( nodeName !== "li" ) return false;


    return controls[target.getAttribute("data-fire")]();
};

const videoPauseEvent = () => {

    const play = document.querySelector("[data-fire=play]");
    const pause = document.querySelector("[data-fire=pause]");

    play.classList.remove("akara-display");

    return pause.classList.add("akara-display");
};

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

const videoPlayEvent = () => {

    const play = document.querySelector("[data-fire=play]");
    const pause = document.querySelector("[data-fire=pause]");

    const notify = __checkPlayStateAndNotify();


    pause.classList.remove("akara-display");

    //setTimeout( notify.close().bind(notify), 5000);

    return play.classList.add("akara-display");
};

const videoLoadedEvent = () => {
    const currentVolumeSet = document.querySelectorAll("[data-volume-set=true]");
    const coverOnError = document.querySelector(".cover-on-error-src");

    video.volume = currentVolumeSet[currentVolumeSet.length - 1].getAttribute("data-volume-controler");


    if ( coverOnError )
        coverOnError.setAttribute("style", "display: none;");

};

const clickedMoveToEvent = event => {

    const target = event.target;

    if ( target.classList.contains("akara-time-length") || target.classList.contains("akara-time-current") ) {
        return handleMovement(event, result => video.currentTime = result);
    }

    return false;
};

const mouseMoveShowCurrentTimeEvent = event => {

    let target = event.target;

    if ( target.classList.contains("akara-time-length") || target.classList.contains("akara-time-current") ) {

        let isOverExists = document.querySelector("[data-hover=true]");

        if ( isOverExists ) {
            isOverExists.remove();
            isOverExists = undefined;
        }

        return handleMovement(event, result => createHoverTime({event,result}) );

    }

    return false;
};

const mouseDownDragEvent = event => event.target.classList.contains("akara-time-current") ?
          jumpToSeekElement.addEventListener("mousemove", moveToDragedPos) : false;


const __removeRedMute = () => {

    const changeVolumeIcon = document.querySelector("[data-fire=volume]");

    if ( changeVolumeIcon.hasAttribute("style") ) {
        changeVolumeIcon.removeAttribute("style");
        controls.unmute();
    }
    return ;
};

const handleVolumeWheelChange = event => {
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
    if ( video.volume <= 0.3 )  return videoEmit.emit("low_volume");

    return videoEmit.emit("high_volume");

};

const handleVolumeChange = event => {

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

    if ( video.volume <= 0.3 ) {
        videoEmit.emit("low_volume");
        return true;
    }

    videoEmit.emit("high_volume");

    return true;
};


const handleLoadedSubtitle = path => {

    if ( ! path ) return ;

    [ path ] = path;

    const __tracks = video.querySelectorAll("track");
    const track = document.createElement("track");
    const subtitle = path;
    let lang = "english" + Math.random(12);

    track.setAttribute("src", subtitle);
    track.setAttribute("label", lang);
    track.setAttribute("srclang", lang);
    track.setAttribute("kind", "subtitles");
    track.setAttribute("id", __tracks.length++);

    video.appendChild(track);

    const { submenu } = videoContextMenu[16].submenu[1];

    submenu.push({
        label: lang,
        click(menuItem) {
            videoEmit.emit("subtitle-asked-for",menuItem);
        },
        accelerator: `CommandOrCtrl+${track.getAttribute("id")}`,
        type: "radio"
    });

    Object.assign(videoContextMenu[16].submenu[1], {
        submenu
    });
};

const MouseHoverOnVideo = () => {
    if ( ! document.webkitIsFullScreen ) return false;
    return akaraControl.removeAttribute("hidden");
};

const MouseNotHoverVideo = () => {

    if ( ! document.webkitIsFullScreen ) return false;

    setTimeout( () => {
        akaraControl.setAttribute("hidden", "true");
    },3000);

    akaraControl.animate({
        opacity: [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]
    },3000);

};

controlElements.addEventListener("click", fireControlButtonEvent);

video.addEventListener("loadeddata", event => {

    currTimeUpdate.textContent = `${getHumanTime(controls.getCurrentTime())} / ${getHumanTime(controls.duration())}`;

    const submenu = videoContextMenu[16].submenu;

    // no need to remove if no subtitle was added in previous videox
    if ( submenu ) {

        Object.assign(videoContextMenu[16].submenu[1],{
            submenu: []
        });
        Array.from(document.querySelectorAll("track"), el => {
            el.remove();
        });
    }

});
video.addEventListener("dblclick", () => {
    
    if ( ! video.hasAttribute("src") ) return false;
        
    if ( document.webkitIsFullScreen )
        return _leavefullscreen();
    else
        return _enterfullscreen();

});
video.addEventListener("mouseover", MouseHoverOnVideo);

video.addEventListener("mouseout", MouseNotHoverVideo);

video.addEventListener("timeupdate", updateTimeIndicator);

video.addEventListener("ended", () => videoEmit.emit("ended"));

video.addEventListener("pause", videoPauseEvent );

video.addEventListener("play", videoPlayEvent );

video.addEventListener("loadstart", videoLoadedEvent);

video.addEventListener("loadedmetadata", () => {
    currTimeUpdate.textContent = `${getHumanTime(controls.getCurrentTime())} / ${getHumanTime(controls.duration())}`;
});

video.addEventListener("error", event => {

    currTimeUpdate.textContent = "00:00 / 00:00";

    document.querySelector(".cover-on-error-src")
        .removeAttribute("style");

    video.removeAttribute("src");

});




video.addEventListener("contextmenu", event => {

    let vidMenuInst ;
    menu.clear();
    console.log(videoContextMenu);
    videoContextMenu.forEach( _menu => {
        vidMenuInst = new MenuItem(_menu);

        disableVideoMenuItem(vidMenuInst);

        menu.append(vidMenuInst);
    });
    menu.popup(getCurrentWindow(), { async: true });
});


jumpToSeekElement.addEventListener("click", clickedMoveToEvent);

jumpToSeekElement.addEventListener("mousemove", mouseMoveShowCurrentTimeEvent);

jumpToSeekElement.addEventListener("mouseout", removeHoverTime);

jumpToSeekElement.addEventListener("mousedown", mouseDownDragEvent);

jumpToSeekElement.addEventListener("mouseup", () =>
                                   jumpToSeekElement.removeEventListener("mousemove", moveToDragedPos));

akaraVolume.addEventListener("click", handleVolumeChange);
akaraVolume.addEventListener("mousewheel", handleVolumeWheelChange);


videoEmit.on("low_volume", type => {

    if ( type ) changeVolumeIcon.setAttribute("style", "color: red");

    changeVolumeIcon.classList.remove("fa-volume-up");
    changeVolumeIcon.classList.add("fa-volume-down");
});

videoEmit.on("high_volume", type => {

    if ( type ) changeVolumeIcon.removeAttribute("style");

    changeVolumeIcon.classList.remove("fa-volume-down");
    changeVolumeIcon.classList.add("fa-volume-up");
});

ipc.on("video-open-file", addMediaFile);
ipc.on("video-open-folder", addMediaFolder);
ipc.on("video-play", _play);
ipc.on("video-pause", _pause);
ipc.on("video-stop", _stop);
ipc.on("video-next", _next);
ipc.on("video-previous", _previous);
ipc.on("video-repeat", () => {
    video.setAttribute("loop", "true");
});

ipc.on("video-no-repeat", () => {
    video.removeAttribute("loop");
});
ipc.on("video-open-external", () => {
    showItemInFolder(video.getAttribute("src").replace("file://",""));
});

ipc.on("normal-speed", () => {
    _setPlaybackRate(1);
});

ipc.on("fast-speed", () => {
    //   DONT HARDCODE THIS
    // configuration value should specify this value
    _setPlaybackRate(12);
});

ipc.on("very-fast-speed", () => _setPlaybackRate(25));

ipc.on("slow-speed", () => _setPlaybackRate(0.7));

ipc.on("very-slow-speed", () => _setPlaybackRate(0.2));

ipc.on("load-sub-computer", (event,val) => handleLoadedSubtitle(val));

videoEmit.on("subtitle-asked-for", mItem => {

    const { length: _textTrackLength } = textTracks;

    for ( let i = 0; i < _textTrackLength; i++ ) {
        if ( mItem.label === textTracks[i].label ) {
            textTracks[i].mode = "showing";
            continue;
        }
        textTracks[i].mode = "disabled";
    }
});

ipc.on("enter-video-fullscreen", _enterfullscreen);
ipc.on("leave-video-fullscreen", _leavefullscreen);