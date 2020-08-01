const timerLeft = document.querySelector(".timerLeft");  
let timerLabel = document.querySelector(".timerLabel");
let isTimerRunning = false;

//controls the loop inside the timer
let playTimerInterval;

//stores the date user played/paused the timer in memory
let currentDate;

let autoStartSession = window.localStorage.getItem('autoStartSession') ?? false;

let autoStartBreaks = window.localStorage.getItem('autoStartBreaks') ?? false;

//let enableNotifications = window.localStorage.getItem('enableNotifications') ?? false;
//user must permit every time the page is opened?
let enableNotifications = window.localStorage.getItem('enableNotifications') ?? false;


//long breaks always on 4th
let sessionCount = 0;

//session, short or long break
let clockState;

init();

function init() {
    initArrows();
    initTimerControls();
    preventSelection();    
    initClock();
    CheckPreferences();
    RequestNotificationPermission();
}

function initArrows() {
    const arrows = document.querySelectorAll(".arrow");
    arrows.forEach(item => {
        item.addEventListener('click', (event) => {

            if (isTimerRunning) {
                alert('It is not allowed to change the session length while session is active, please pause it first');
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
                time.value =  parseInt(time.value) + 1;
                updateValueOnScreen(time, time.value);
            }

            if (item.classList.contains('fa-arrow-down')) {                
                if (time.value <= 0)
                    return;

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
    let date = new Date().toLocaleString("pt-BR", {timeZone: "America/Sao_Paulo"})
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
debugger;
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
                    clockState = checkNextSession(timerLabel);                    
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
    const percentageLeft = Math.round((timeLeft/totalTime) * 100);         
    const percentageDone = 100 - percentageLeft;                    
    return percentageDone;
}

//sessionOrBreak -> session, shortBreak or longBreak string
function playTimer(minutes, seconds, fromDate, sessionOrBreak) {      
    clockState = sessionOrBreak;
    //we need another memory address in order to calculate it, since our function advanceTime changes fromDate
    //and if we keep a value of fromDate in a variable, this variable will point to the fromDate and will be changed, because 
    //it points to fromDate
    
    //date we received with another memory address, current date    
    let fromDateOld = new Date(
        fromDate.getFullYear(),
        //fromDate.getUTCMonth(),
        fromDate.getMonth(),
        fromDate.getDate(),
        //fromDate.getUTCDate(), 
        //parseInt(fromDate.toString().split(' ')[2]), //do not use getUTCDate since daylight gets things messy sometimes
        fromDate.getHours(),
        fromDate.getMinutes(),
        fromDate.getSeconds()        
    )                      

    //date ahead to calculate time left
    let fromDateNew = advanceTime(minutes, seconds, fromDate); 
                   
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

        if (timeLeft != -1) 
        {                        
            updateValueOnScreen(timerLeft, timeLeft);
            title.innerHTML = `(${timeLeft}) Pomodoro Clock`;
        } 
        else
        {                         
            debugger;  
            title.innerHTML = 'Pomodoro Clock';
            playAudio();              
            pauseTimer();            
            currentDate = new Date();   
            SendNotification(sessionOrBreak);    
                        
            //current session has ended, next one will be a short/long break
            if (sessionOrBreak == "session") {
                sessionCount += 1;
                updateSessionLabel(sessionOrBreak, true);                
                //playAudio();
                
                if (autoStartBreaks == 'true') {

                    updateSessionLabel(sessionOrBreak, false);

                    //check if new session is short or long break
                    if (sessionCount % 4 == 0) {                        
                        const longBreakTimeValue = document.querySelector(".longBreakTime").value;                                                
                        playTimer(longBreakTimeValue, 0, currentDate, "longBreak");
                    }
                    else 
                    {
                        const shortBreakTimeValue = document.querySelector(".shortBreakTime").value;                                                  
                        playTimer(shortBreakTimeValue,0, currentDate, "shortBreak");
                    }
                }                 
                else
                {                      
                    //autoStartBreaks is false, user needs to manually restart the timer
                }                
            }
            //we were on a short or long break, so let's start a new session
            else
            {   
                updateSessionLabel(sessionOrBreak, true);
                //playAudio();
                clockState = "session";

                if (autoStartSession == 'true') {                                    
                    const sessionLengthValue = document.querySelector(".inputSessionTime").value;                                      
                    playTimer(sessionLengthValue, 0 , currentDate, clockState);
                    updateSessionLabel(sessionOrBreak, false);                    
                }   
                else
                {
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
function calculateTimeLeft(fromDate, today) {           
    //subtracts 1s from minute left so we start our timer right after user clicks on it
    //let minutesLeft = millisecondsToMinutes((fromDate - today) - 1 * 1000);       
    let minutesLeft = millisecondsToMinutes((fromDate - today));       
    let secondsLeft;     

    if (minutesLeft < 10 && minutesLeft > 0) 
        minutesLeft = "0" + minutesLeft;    

    if (!Number.isInteger(minutesLeft))         
        secondsLeft = ((minutesLeft - minutesLeft.toString().substring(0,2)) * 60).toString().split('.')[0];

    if (!secondsLeft)
        secondsLeft = 0;

    if (secondsLeft < 10 && secondsLeft >= 0)
        secondsLeft = "0" + secondsLeft;

    minutesLeft = minutesLeft.toString().substring(0,2);
    secondsLeft = secondsLeft.toString().substring(0,2);

    if (minutesLeft <= 0 && secondsLeft <= 0) 
        return -1;                

    return minutesLeft + ":" + secondsLeft;           
}

function millisecondsToMinutes(millisecond) {
    return (millisecond/1000/60);
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

function checkNextSession(timerLabel) {
    const label = timerLabel.innerHTML;
    switch (label) {
        case "Session finished": {        
            if (sessionCount % 4 == 0)                
                return "longBreak";                       
            return "shortBreak";                
        }        
        case "Short break finished": {
            return "session";            
        }
        case "Long break finished" : {
            return "session";                         
        }
        default: {
            console.error("invalid session");
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
        case "longBreak" : {
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
        case 'longBreak' : {
            timeHasEnded ? timerLabel.innerHTML = 'Long break finished' : timerLabel.innerHTML = 'Long break';
            break;
        }
        default: {
            console.error('invalid session');
            break;
        }
    }
}


function CheckPreferences() {
    const items = document.querySelectorAll(".preferences input[type=checkbox]");
    items.forEach(item => {
        item.addEventListener('click', (event) => {                        
            
            switch (item.id) {
                case "enableNotifications": {   
                    if (item.checked) { //enable
                        if (GetNotificationStatus() == 'granted') {
                            enableNotifications = true;
                        }
                        else 
                        {                   
                            enableNotifications = false;         
                            item.checked = false;
                            RequestNotificationPermission();                            
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
            if (GetNotificationStatus() == 'granted') {
                item.checked = true;
                enableNotifications = true;
            }
                
            return;
        }

        item.checked = true;
        return;
    }                                            
}

function RequestNotificationPermission() {
    
    if (Notification.permission != 'granted') {
        Notification.requestPermission().then(permission => {            
            if (permission == 'granted')
                document.querySelector("#enableNotifications").checked = true;
                window.localStorage.setItem('enableNotifications', 'true');
            console.log(permission);
        })
    }
}

function GetNotificationStatus() {
    return Notification.permission;
}

                
function NewNotification(title, bodyText) {
    const notification = new Notification(title, {
        icon: 'http://cdn.sstatic.net/stackexchange/img/logos/so/so-icon.png',
        body: bodyText
    });
}

function SendNotification(clockState) {
    let notification = NotificationMessage(clockState);
    return new Notification(notification.title, notification.options);    
}

function NotificationMessage(clockState) {
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
        case 'longBreak' : {            
            notification.options.body = 'Your long break time has finished';
            break;
        }
        default: {            
            break;
        }        
    }
    return notification;
}