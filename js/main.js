const timerLeft = document.querySelector(".timerLeft");
let timerLabel = document.querySelector(".timerLabel");
let isTimerRunning = false;

//controls the loop inside the timer
let playTimerInterval;

//stores the date user played/paused the timer in memory
let currentDate;

let autoStartSession = window.localStorage.getItem('autoStartSession') ?? false;
let autoStartBreaks = window.localStorage.getItem('autoStartBreaks') ?? false;
let enableNotifications = window.localStorage.getItem('enableNotifications') ?? false;
let audioVolume = (window.localStorage.getItem('audioVolume') / 100) ?? 1;
let sessionLength = parseInt(window.localStorage.getItem('sessionLength') ?? document.querySelector('input.inputSessionTime').value ?? 25);
let shortBreakLength = parseInt(window.localStorage.getItem('shortBreakLength') ?? document.querySelector('input.shortBreakTime').value ?? 5);
let longBreakLength = parseInt(window.localStorage.getItem('longBreakLength') ?? document.querySelector('input.longBreakTime').value ?? 10);

//long breaks always on 4th
let sessionCount = 0;

//can be session, short or long break
let clockState;

init();

function init() 
{
    initArrows();
    initTimerControls();
    preventSelection();
    initClock();
    checkPreferences();
    requestNotificationPermission();
}

function initArrows() 
{
    const arrows = document.querySelectorAll(".arrow");
    arrows.forEach(item => {
        item.addEventListener('click', (event) => {

            if (isTimerRunning) 
            {
                alert('It is not allowed to change the session length while timer is running, please pause it first');
                return;
            }

            //get corresponding time length according to what user clicked
            let time = item.parentNode.children.namedItem("input");

            let session = getSession(timerLeft);

            if (item.classList.contains('fa-arrow-up')) 
            {
                //increase only session
                if (time.classList.contains("inputSessionTime") && time.value >= 0) 
                {
                    session = updateSession(session, parseInt(session.minutes) + 1, null);
                    updateScreen(timerLeft, `${session.minutes}:${session.seconds}`);                                        
                }
                //increase all timers and variables
                time.value = parseInt(time.value) + 1;
                saveToLocalStorage(time.getAttribute('data-localstorage'), time.value);                
                saveToLocalVariable(time.getAttribute('data-localstorage'), time.value);                
                updateScreen(time, time.value);
            }

            if (item.classList.contains('fa-arrow-down')) 
            {
                if (time.value <= 1) 
                {
                    alert('Please enter a valid value');
                    return;
                }

                //decrease only session
                if (time.classList.contains('inputSessionTime') && time.value >= 0) 
                {
                    session = updateSession(session, parseInt(session.minutes) - 1, null);
                    updateScreen(timerLeft, `${session.minutes}:${session.seconds}`);
                }

                //decrease all timers and variables
                time.value = parseInt(time.value) - 1;
                saveToLocalStorage(time.getAttribute('data-localstorage'), time.value);
                saveToLocalVariable(time.getAttribute('data-localstorage'), time.value);
                updateScreen(time, time.value);                
            }
        })
    })
}

//receives a string containg a variable name and saves a value inside that variable
function saveToLocalVariable(variableName, value) 
{
    eval(variableName + '=' + value);                
}

function saveToLocalStorage(key, value) 
{
    window.localStorage.setItem(key, value);
}

function updateSession(session, minutes, seconds) 
{
    if (session == null) return;
    if (minutes != null) session.minutes = minutes;
    if (seconds != null) session.seconds = seconds;
    return formatSession(session);
}

function formatSession(session) 
{
    if (session == null || session.minutes == null || session.seconds == null) return;

    if ((typeof (session.minutes) == 'number' || typeof (session.minutes == 'string') && session.minutes.length == 1) && session.minutes < 10)
        session.minutes = `0${session.minutes}`;

    if ((typeof (session.seconds) == 'number' || typeof (session.seconds == 'string') && session.seconds.length == 1) && session.seconds < 10)
        session.seconds = `0${session.seconds}`;

    return session;
}

//session must be represented as a string to keep leading zero(s)
function getSession(timerLeft) 
{
    const timeLeft = timerLeft.innerHTML.split(':');
    return session = {
        minutes: timeLeft[0] < 10 && timeLeft[0].length == 1 ? `0${timeLeft[0]}` : timeLeft[0],
        seconds: timeLeft[1] < 10 && timeLeft[1].length == 1 ? `0${timeLeft[1]}` : timeLeft[1]
    };    
}

function updateScreen(elementToBeChanged, newValue) 
{
    elementToBeChanged.value = newValue;
    elementToBeChanged.innerHTML = newValue;
};

//prevent selection of input values if multiple clicking mouse button
function preventSelection() 
{
    document.addEventListener('mousedown', (event) => {
        if (event.detail > 1)
            event.preventDefault();
    }, false);
};


//return a date object in GMT - 3
function getNewDate() 
{    
    let dateStr = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });    

    //replace DD/MM/YYYY for MM/DD/YYYY to instantiate a new date object from string
    dateStr = dateStr.replace(/(\d{2})\/(\d{2})/g, `$2/$1`);

    return new Date(dateStr);    
}

//initializes play, pause and refresh controls 
function initTimerControls() 
{
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
                if (time == '00:00') 
                {
                    clockState = checkNextSession(clockState);
                    minutes = getSessionLength(clockState, 'minutes'); 
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
function advanceTime(minutes, seconds, fromDate) 
{
    const date = new Date(fromDate);
    date.setMinutes(date.getMinutes() + parseInt(minutes));
    date.setSeconds(date.getSeconds() + parseInt(seconds));
    return date;
}

function playAudio() 
{
    const audioCompleted = new Audio('assets/audios/done.wav');
    audioCompleted.volume = audioVolume;
    audioCompleted.play();
}

//totalTime and timeLeft in milliseconds
function percentageTimeSpent(totalTime, timeLeft) 
{
    const percentageLeft = Math.round((timeLeft / totalTime) * 100);
    const percentageDone = 100 - percentageLeft;
    return percentageDone;
}

//sessionOrBreak -> session, shortBreak or longBreak string
function playTimer(minutes, seconds, fromDate, sessionOrBreak) 
{
    clockState = sessionOrBreak;

    let dateOld = fromDate;

    //date ahead to calculate time left, disregard 1s so timer starts right away
    let dateAhead = advanceTime(minutes, parseInt(seconds) - 1, fromDate);
    
    let totalTime = getSessionLength(sessionOrBreak, 'milliseconds');

    updateSessionLabel(sessionOrBreak, false);

    playTimerInterval = setInterval(() => {
        let timeLeft = calculateTimeLeft(dateAhead, dateOld);

        let percentageCompleted = timeLeft == -1 ? 100 : percentageTimeSpent(totalTime, dateAhead - dateOld);

        fillClockBorder(document.querySelector(".c100"), percentageCompleted);

        //update old date to calculate time left every 1 sec
        dateOld.setSeconds(dateOld.getSeconds() + 1);

        let title = document.querySelector("title");

        if (timeLeft != -1) {
            updateScreen(timerLeft, `${timeLeft.minutes}:${timeLeft.seconds}`);                        
            title.innerHTML = `(${timeLeft.minutes}:${timeLeft.seconds}) Pomodoro Clock`;
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

                if (autoStartBreaks == 'true' || autoStartBreaks == true) {
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

                if (autoStartSession == 'true' || autoStartSession == true) {
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

function pauseTimer() 
{
    clearInterval(playTimerInterval);    
    currentDate = getNewDate();
    isTimerRunning = false;
}

//stop timer, get session length and display on session
function refresh() 
{
    pauseTimer();
    sessionCount = 0;
    document.querySelector("title").innerHTML = 'Pomodoro Clock';

    //undefined or 'session'
    clockState = undefined;

    const sessionLengthValue = document.querySelector(".inputSessionTime").value;
    updateScreen(timerLeft, "0" + sessionLengthValue + ":00");
    updateScreen(timerLabel, "Session");

    let clockClasses = document.querySelector(".c100").classList;
    clockClasses.forEach((elClass, elIndex) => {
        if (elClass.toString().startsWith("p"))
            clockClasses.remove(elClass);
    });

}

//calculate time left on minutes and seconds
//returns -1 if date is reached
function calculateTimeLeft(from, to) 
{
    const diff = from.getTime() - to.getTime();
    let millisecondsLeft = diff;

    const minutes = Math.floor(millisecondsLeft / 1000 / 60);
    millisecondsLeft -= minutes * 1000 * 60;

    const seconds = Math.floor(millisecondsLeft / 1000);
    millisecondsLeft -= seconds * 1000;

    if (minutes <= 0 && seconds <= 0)
        return -1;

    return formatTimeLeft(minutes, seconds);
}

//displays minute and second < 10 with 2 digits, i.e: 05s
function formatTimeLeft(min, sec) 
{
    return time = {
        minutes: min < 10 && min >= 0 ? `0${min}` : `${min}`,
        seconds: sec < 10 && sec >= 0 ? `0${sec}` : `${sec}`,
    };    
}

function millisecondsToMinutes(millisecond) 
{
    return (millisecond / 1000 / 60);
}

function minutesToMilliseconds(minute) 
{
    return minute * 60 * 1000;
}

//Fills circle border based on time spent
function fillClockBorder(node, percentageCompleted) 
{
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
function initClock() 
{
    setInterval(() => {
        const date = new Date();

        let hours = ((date.getHours() + 11) % 12 + 1);
        let minutes = date.getMinutes();
        let seconds = date.getSeconds();

        hour = hours * 30;
        minute = minutes * 6;
        second = seconds * 6;

        document.querySelector('.hour').style.transform = `rotate(${hour}deg)`
        document.querySelector('.minute').style.transform = `rotate(${minute}deg)`
        document.querySelector('.second').style.transform = `rotate(${second}deg)`
    }, 1000);
}

function checkNextSession(clockState) 
{
    switch (clockState) 
    {
        case 'session':
            {
                if (sessionCount % 4 == 0)
                    return 'longBreak';
                return 'shortBreak';
            }
        case 'shortBreak':
            {
                return 'session';
            }
        case 'longBreak':
            {
                return 'session';
            }
        default:
            {
                console.error('invalid next session');
                break;
            }
    }
}

function getSessionLength(clockState, unitOfTime) 
{
    switch (clockState) 
    {
        case "session": 
        {            
            return +
            unitOfTime == 'minutes' ? sessionLength : 
            unitOfTime == 'milliseconds' ? minutesToMilliseconds(sessionLength) : 
            sessionLength;            
        }
        case "shortBreak": 
        {     
            return +
            unitOfTime == 'minutes' ? shortBreakLength : 
            unitOfTime == 'milliseconds' ? minutesToMilliseconds(shortBreakLength) : 
            shortBreakLength;                  
        }
        case "longBreak": 
        {        
            return +
            unitOfTime == 'minutes' ? longBreakLength : 
            unitOfTime == 'milliseconds' ? minutesToMilliseconds(longBreakLength) : 
            longBreakLength;                
        }
        default: 
        {
            console.error("invalid session");
            break;
        }
    }
}

//timeHasEnded -> if true, will display finished labels 
function updateSessionLabel(clockState, timeHasEnded) 
{
    if (timeHasEnded)
        timerLeft.innerHTML = '00:00';

    switch (clockState) 
    {
        case 'session': 
        {
            timeHasEnded ? timerLabel.innerHTML = 'Session finished' : timerLabel.innerHTML = 'Session';
            break;
        }
        case 'shortBreak': 
        {
            timeHasEnded ? timerLabel.innerHTML = 'Short break finished' : timerLabel.innerHTML = 'Short break';
            break;
        }
        case 'longBreak': 
        {
            timeHasEnded ? timerLabel.innerHTML = 'Long break finished' : timerLabel.innerHTML = 'Long break';
            break;
        }
        default: 
        {
            console.error('invalid session');
            break;
        }
    }
}

function checkPreferences() {
    checkBoxPreferences();
    checkVolume();
    checkLenghts();
}

function checkBoxPreferences() 
{
    const items = document.querySelectorAll(".preferences input[type=checkbox]");
    items.forEach(item => {
        item.addEventListener('click', (event) => {

            switch (item.id) 
            {
                case "enableNotifications":
                    {
                        if (item.checked) 
                        { 
                            if (getNotificationStatus() == 'granted') 
                            {
                                enableNotifications = true;
                            }
                            else 
                            {
                                enableNotifications = false;
                                item.checked = false;
                                requestNotificationPermission();
                            }
                        }
                        break;
                    }
                case "autoStartSession":
                    {
                        autoStartSession = item.checked;
                        break;
                    }
                case "autoStartBreaks":
                    {
                        autoStartBreaks = item.checked;
                        break;
                    }
                default:
                    {
                        break;
                    }
            }
            window.localStorage.setItem(item.id, item.checked);
        });
        setPreferencesBasedOnLocalStorage(item);        
    })                
}

function checkLenghts() 
{
    document.querySelector('input.inputSessionTime').value = sessionLength;
    document.querySelector('input.shortBreakTime').value = shortBreakLength;
    document.querySelector('input.longBreakTime').value = longBreakLength;
    timerLeft.innerHTML = (sessionLength < 10 ? `0${sessionLength}` : `${sessionLength}`) + `:00`;
}

function checkVolume() 
{
    let volume = document.querySelector("input[type=range]#audioVolume");
    const audio = window.localStorage.getItem('audioVolume');

    if (audioVolume != null) 
        volume.value = audio;

    volume.addEventListener('change', (event) => {
        window.localStorage.setItem('audioVolume', volume.value);
        audioVolume = volume.value / 100;
    });

}

function setPreferencesBasedOnLocalStorage(item) 
{
    let value = window.localStorage.getItem(item.id);

    //if item on localstorage is set to true and checkbox is not checked
    if (value == 'true' && !item.checked) 
    {
        if (item.id == 'enableNotifications') 
        {
            if (getNotificationStatus() == 'granted') 
            {
                item.checked = true;
                enableNotifications = true;
            }
            return;
        }
        item.checked = true;
        return;
    }
}


function requestNotificationPermission() 
{
    if (Notification.permission != 'granted') {
        Notification.requestPermission().then(permission => {
            if (permission == 'granted')
                document.querySelector("#enableNotifications").checked = true;
            window.localStorage.setItem('enableNotifications', 'true');
            console.log(`Notifications ${permission}`);
        })
    }
}

function getNotificationStatus() 
{
    return Notification.permission;
}

function sendNotification(clockState) 
{
    let notification = notificationMessage(clockState);
    return new Notification(notification.title, notification.options);
}

function notificationMessage(clockState) 
{
    let notification = {
        title: 'Pomodoro Clock',
        options: {
            icon: '../Pomodoro/assets/images/tomatoIcon.png',
            lang: 'en-US',
        }
    };

    switch (clockState) 
    {
        case 'session': 
        {
            notification.options.body = 'Your session time has finished';
            break;
        }
        case 'shortBreak': 
        {
            notification.options.body = 'Your short break time has finished';
            break;
        }
        case 'longBreak': 
        {
            notification.options.body = 'Your long break time has finished';
            break;
        }
        default: 
        {
            break;
        }
    }
    return notification;
}        