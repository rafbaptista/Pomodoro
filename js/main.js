const timerLeft = document.querySelector(".timerLeft");
let timerLabel = document.querySelector(".timerLabel");
let isTimerRunning = false;

//controls the loop inside the timer
let playTimerInterval;

//stores the date user played/paused the timer in memory
let currentDate;

let autoStartSession = window.localStorage.getItem('autoStartSession') ?? false;
let autoStartBreaks = window.localStorage.getItem('autoStartBreaks') ?? false;

//only stored true if notifications were permitted by the user
let enableNotifications = window.localStorage.getItem('enableNotifications') ?? false;

//long breaks always on 4th
let sessionCount = 0;

//can be session, short or long break
let clockState;

init();

function init() {
    initArrows();
    initTimerControls();
    preventSelection();
    initClock();
    checkPreferences();
    requestNotificationPermission();
}

function initArrows() {
    const arrows = document.querySelectorAll(".arrow");
    arrows.forEach(item => {
        item.addEventListener('click', (event) => {

            if (isTimerRunning) {
                alert('It is not allowed to change the session length while timer is running, please pause it first');
                return;
            }

            //get corresponding time length according to what user clicked
            let time = item.parentNode.children.namedItem("input");

            let session = timerLeft.innerHTML.split(':');

            if (item.classList.contains('fa-arrow-up')) {

                //increase session time
                if (time.classList.contains("inputSessionTime") && time.value >= 0) {
                    session[0] = parseInt(session[0]) + 1;
                    console.log(session[0]);
                    session = session.join().replace(',', ':');
                    updateValueOnScreen(timerLeft, session);
                }
                time.value = parseInt(time.value) + 1;
                updateValueOnScreen(time, time.value);
            }

            if (item.classList.contains('fa-arrow-down')) {
                if (time.value <= 1) {
                    alert('Please enter a valid value');
                    return;
                }


                time.value = parseInt(time.value) - 1;
                updateValueOnScreen(time, time.value);

                //decrease session time
                if (time.classList.contains('inputSessionTime') && time.value >= 0) {
                    console.log(session);
                    session[0] = parseInt(session[0] - 1);
                    session = session.join().replace(',', ':');
                    updateValueOnScreen(timerLeft, session);
                }
            }

        })
    })

}

//just update values on screen
function updateValueOnScreen(elementToBeChanged, newValue) {
    elementToBeChanged.value = newValue;
    elementToBeChanged.innerHTML = newValue;
};

//prevent selection of input values if multiple clicking mouse button
function preventSelection() {
    document.addEventListener('mousedown', (event) => {
        if (event.detail > 1)
            event.preventDefault();
    }, false);
};


function getNewDate() {
    //GMT -3
    let date = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
    let infos = date.split(' ');

    //dd/MM/yyyy
    let fullDate = infos[0].split('/');

    //hh/mm/ss
    let fullHour = infos[1].split(':');

    return new Date(
        fullDate[2],
        fullDate[1] - 1,
        fullDate[0],
        fullHour[0],
        fullHour[1],
        fullHour[2],
    );
}

//initializes play, pause and refresh controls 
function initTimerControls() {
    const controls = document.querySelectorAll(".timerControl");
    controls.forEach(item => {
        item.addEventListener('click', () => {

            if (item.classList.contains('fa-play')) {

                if (isTimerRunning)
                    return;

                isTimerRunning = true;

                if (!currentDate)
                    currentDate = getNewDate();

                let time = timerLeft.innerHTML;
                let minutes = time.substring(0, time.indexOf(':'));
                let seconds = time.substring(time.indexOf(':') + 1, time.length);

                //if session/break has ended && is not set to auto start && user restart manually
                if (time == '00:00') {
                    clockState = checkNextSession(clockState);
                    minutes = getSessionLength(clockState) / (60 * 1000); //get milliseconds to minutes                                        
                }

                playTimer(minutes, seconds, currentDate, clockState ?? 'session');
            }

            if (item.classList.contains('fa-pause'))
                pauseTimer();

            if (item.classList.contains('fa-sync'))
                refresh();
        })
    })
};

//advances the datetime object to be able to calculate time difference from now to X minutes
function advanceTime(minutes, seconds, fromDate) {
    fromDate.setMinutes(fromDate.getMinutes() + parseInt(minutes));
    fromDate.setSeconds(fromDate.getSeconds() + parseInt(seconds));
    return fromDate;
}

//TODO: set audio volume
function playAudio() {
    const audioCompleted = new Audio('assets/audios/done.wav');
    audioCompleted.play();
}

//totalTime and timeLeft in milliseconds
function percentageTimeSpent(totalTime, timeLeft) {
    const percentageLeft = Math.round((timeLeft / totalTime) * 100);
    const percentageDone = 100 - percentageLeft;
    return percentageDone;
}

//sessionOrBreak -> session, shortBreak or longBreak string
function playTimer(minutes, seconds, fromDate, sessionOrBreak) {
    clockState = sessionOrBreak;

    //older datetime object with different memory address since AdvanceTime() alters fromDate
    let fromDateOld = new Date(
        fromDate.getFullYear(),
        fromDate.getMonth(),
        fromDate.getDate(),
        fromDate.getHours(),
        fromDate.getMinutes(),
        fromDate.getSeconds()
    )

    //date ahead to calculate time left
    //disregard 1s so timer starts right away
    let fromDateNew = advanceTime(minutes, seconds - 1, fromDate);

    //total time in milliseconds  
    let totalTime;

    totalTime = getSessionLength(sessionOrBreak);

    updateSessionLabel(sessionOrBreak, false);


    playTimerInterval = setInterval(() => {

        let timeLeft = calculateTimeLeft(fromDateNew, fromDateOld);

        let percentageCompleted = timeLeft == -1 ? 100 : percentageTimeSpent(totalTime, fromDateNew - fromDateOld);

        fillClockBorder(document.querySelector(".c100"), percentageCompleted);

        //update old date to calculate time left every 1 sec
        fromDateOld.setSeconds(fromDateOld.getSeconds() + 1);

        let title = document.querySelector("title");

        if (timeLeft != -1) {
            updateValueOnScreen(timerLeft, timeLeft);
            title.innerHTML = `(${timeLeft}) Pomodoro Clock`;
        }
        else {
            title.innerHTML = 'Pomodoro Clock';
            playAudio();
            pauseTimer();
            //currentDate = new Date();   
            sendNotification(sessionOrBreak);

            //current session has ended, next one will be a short/long break
            if (sessionOrBreak == "session") {
                sessionCount += 1;
                updateSessionLabel(sessionOrBreak, true);
                //playAudio();

                if (autoStartBreaks == 'true') {

                    updateSessionLabel(sessionOrBreak, false);

                    //check if new session is short or long break
                    if (sessionCount % 4 == 0) {
                        clockState = 'longBreak';
                        const longBreakTimeValue = document.querySelector(".longBreakTime").value;
                        playTimer(longBreakTimeValue, 0, currentDate, "longBreak");
                    }
                    else {
                        clockState = 'shortBreak';
                        const shortBreakTimeValue = document.querySelector(".shortBreakTime").value;
                        playTimer(shortBreakTimeValue, 0, currentDate, "shortBreak");
                    }
                }
                else {
                    //autoStartBreaks is false, user needs to manually restart the timer
                }
            }
            //we were on a short or long break, so let's start a new session
            else {
                updateSessionLabel(sessionOrBreak, true);
                //playAudio();
                

                if (autoStartSession == 'true') {
                    clockState = "session";
                    const sessionLengthValue = document.querySelector(".inputSessionTime").value;
                    updateSessionLabel(sessionOrBreak, false);
                    playTimer(sessionLengthValue, 0, currentDate, clockState);
                }
                else {
                    //autoStartSession is false, user needs to manually restart the timer
                }
            }
        }
    }, 1000);
}

//actually stops timer, carefull
function pauseTimer() {
    clearInterval(playTimerInterval);
    currentDate = new Date();
    isTimerRunning = false;
}

//stop timer, get session length and display on session
function refresh() {
    pauseTimer();
    sessionCount = 0;
    document.querySelector("title").innerHTML = 'Pomodoro Clock';

    //undefined or 'session'
    clockState = undefined;

    const sessionLengthValue = document.querySelector(".inputSessionTime").value;
    updateValueOnScreen(timerLeft, "0" + sessionLengthValue + ":00");
    updateValueOnScreen(timerLabel, "Session");

    let clockClasses = document.querySelector(".c100").classList;
    clockClasses.forEach((elClass, elIndex) => {
        if (elClass.toString().startsWith("p"))
            clockClasses.remove(elClass);
    });

}

//calculate time left on minutes and seconds, displaying minute and second < 10 with 2 digits, i.e: 05s
//returns -1 if date is reached
function calculateTimeLeft(from, to) {
    let minutes = millisecondsToMinutes((from - to)).toString();
    let seconds = minutes.indexOf('.') == -1 ? '0' :
        (('0.' + minutes.substring(minutes.indexOf('.') + 1, minutes.length)) * 60).toString();

    minutes = minutes.indexOf('.') == -1 ? minutes : minutes.substring(0, minutes.indexOf('.'));
    seconds = seconds.indexOf('.') == -1 ? seconds : seconds.substring(0, seconds.indexOf('.'));

    if (seconds < 10 && seconds >= 0)
        seconds = `0${seconds}`;

    if (minutes < 10 && minutes >= 0)
        minutes = `0${minutes}`;

    if (minutes <= 0 && seconds <= 0)
        return -1;

    return `${minutes.substring(0, 2)}:${seconds.substring(0, 2)}`
}

function millisecondsToMinutes(millisecond) {
    return (millisecond / 1000 / 60);
}

function minutesToMilliseconds(minute) {
    return minute * 60 * 1000;
}

//Fills circle border based on time spent
function fillClockBorder(node, percentageCompleted) {
    const element = node;

    //remove previous class styles
    element.classList.forEach(item => {
        if (item.startsWith('p'))
            element.classList.remove(item);
    })

    element.classList.add(`p${percentageCompleted}`);
    percentageCompleted++;
}

//Display real time on clock 
function initClock() {

    setInterval(() => {
        const date = new Date();

        const hours = ((date.getHours() + 11) % 12 + 1);
        const minutes = date.getMinutes();
        const seconds = date.getSeconds();

        const hour = hours * 30;
        const minute = minutes * 6;
        const second = seconds * 6;

        document.querySelector('.hour').style.transform = `rotate(${hour}deg)`
        document.querySelector('.minute').style.transform = `rotate(${minute}deg)`
        document.querySelector('.second').style.transform = `rotate(${second}deg)`
    }, 1000);
}

function checkNextSession(clockState) {
    switch (clockState) {
        case 'session': {
            if (sessionCount % 4 == 0)
                return 'longBreak';
            return 'shortBreak';
        }
        case 'shortBreak': {
            return 'session';
        }
        case 'longBreak': {
            return 'session';
        }
        default: {
            console.error('invalid next session');
            break;
        }
    }
}

function getSessionLength(clockState) {
    switch (clockState) {
        case "session": {
            return minutesToMilliseconds(document.querySelector(".inputSessionTime").value);
        }
        case "shortBreak": {
            return minutesToMilliseconds(document.querySelector(".shortBreakTime").value);
        }
        case "longBreak": {
            return minutesToMilliseconds(document.querySelector(".longBreakTime").value);
        }
        default: {
            console.error("invalid session");
            break;
        }
    }
}

//timeHasEnded -> if true, will display finished labels 
function updateSessionLabel(clockState, timeHasEnded) {
    if (timeHasEnded)
        timerLeft.innerHTML = '00:00';

    switch (clockState) {
        case 'session': {
            timeHasEnded ? timerLabel.innerHTML = 'Session finished' : timerLabel.innerHTML = 'Session';
            break;
        }
        case 'shortBreak': {
            timeHasEnded ? timerLabel.innerHTML = 'Short break finished' : timerLabel.innerHTML = 'Short break';
            break;
        }
        case 'longBreak': {
            timeHasEnded ? timerLabel.innerHTML = 'Long break finished' : timerLabel.innerHTML = 'Long break';
            break;
        }
        default: {
            console.error('invalid session');
            break;
        }
    }
}


function checkPreferences() {
    const items = document.querySelectorAll(".preferences input[type=checkbox]");
    items.forEach(item => {
        item.addEventListener('click', (event) => {

            switch (item.id) {
                case "enableNotifications": {
                    if (item.checked) { //enable
                        if (getNotificationStatus() == 'granted') {
                            enableNotifications = true;
                        }
                        else {
                            enableNotifications = false;
                            item.checked = false;
                            requestNotificationPermission();
                        }
                    }
                    break;
                }
                case "autoStartSession": {
                    autoStartSession = item.checked;
                    break;
                }
                case "autoStartBreaks": {
                    autoStartBreaks = item.checked;
                    break;
                }
                default: {
                    break;
                }
            }
            window.localStorage.setItem(item.id, item.checked);
        });
        setPreferencesPermissionBasedOnLocalStorage(item);
    })
}

function setPreferencesPermissionBasedOnLocalStorage(item) {
    let value = window.localStorage.getItem(item.id);

    //if item on localstorage is set to true and checkbox is not checked
    if (value == 'true' && !item.checked) {

        if (item.id == 'enableNotifications') {
            if (getNotificationStatus() == 'granted') {
                item.checked = true;
                enableNotifications = true;
            }

            return;
        }

        item.checked = true;
        return;
    }
}

function requestNotificationPermission() {

    if (Notification.permission != 'granted') {
        Notification.requestPermission().then(permission => {
            if (permission == 'granted')
                document.querySelector("#enableNotifications").checked = true;
            window.localStorage.setItem('enableNotifications', 'true');
            console.log(permission);
        })
    }
}

function getNotificationStatus() {
    return Notification.permission;
}

function sendNotification(clockState) {
    let notification = notificationMessage(clockState);
    return new Notification(notification.title, notification.options);
}

function notificationMessage(clockState) {
    let notification = {
        title: 'Pomodoro Clock',
        options: {
            icon: '../Pomodoro/assets/images/tomatoIcon.png',
            lang: 'en-US',
        }
    };

    switch (clockState) {
        case 'session': {
            notification.options.body = 'Your session time has finished';
            break;
        }
        case 'shortBreak': {
            notification.options.body = 'Your short break time has finished';
            break;
        }
        case 'longBreak': {
            notification.options.body = 'Your long break time has finished';
            break;
        }
        default: {
            break;
        }
    }
    return notification;
}