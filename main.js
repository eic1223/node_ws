const express = require('express');
var port = process.env.PORT || 3000;
const server = express()
  .listen(port, () => console.log(`Listening on ${port}`));

const { Server: WebSocket } = require('ws');
const wss = new WebSocket({ server }), webSockets = {};


let msg = "";

let msgWelcome = '{"sender": "server", "target": "all", "command": "SHOW_MESSAGE", "value": "You READY?"}';

// '매치(Match)'는 두 플레이어가 승부를 겨루는 하나의 사이클을 의미함. 
// 매치는 여러개의 퀴즈를 가짐(일단 지금은 3개만)

// '퀴즈(Quiz)'는 퀴즈. quizId, quizText, answer로 구성..

// '시퀀스(sequence)'는 각 퀴즈의 정답을 글자 단위로 쪼갠 것을 의미함 
let answerSequence = [];
let curAnswerSequence = 0;

// 지금 정답 기회를 가진 유저의 이름
let answeringUserName = "none";

var id = 1000;

// 유저 이름과 id를 매칭시켜놓은 맵
var mapUsernameAndId = new Map();

// 스코어는 어디에 저장하지..? 
let score_player1 = 0;
let score_player2 = 0;


// [퀴즈 데이터 모음]
const quiz1 = '{"sender": "server", "target": "all", "command": "SHOW_QUIZ", "value": "슈퍼스타 원동인이 태어난 연도는? (정답:4321)"}';
const quiz1_answer = "4321";
const quiz2 = '{"sender": "server", "target": "all", "command": "SHOW_QUIZ", "value": "세젤귀 원동인이 좋아하는 숫자는? (정답:1234)"}';
const quiz2_answer = "1234";
const quiz3 = '{"sender": "server", "target": "all", "command": "SHOW_QUIZ", "value": "하루에 네 번 사랑을 말하고 여덟 번 웃고 여섯 번의 키스를 해줘 /2 = ?(정답:243)"}';
const quiz3_answer = "243";

let quizList = [quiz1, quiz2, quiz3]
let quizAnswerList = [quiz1_answer, quiz2_answer, quiz3_answer]
// 


// 웹소켓(클라이언트) 연결되었을 때
wss.on('connection', function connection(client) {
    client.send(msgWelcome);

    client.on('message', function incoming(message) {
        msg = message;
        console.log("Received msg:\n" + message);
        //sendServerMsg(msg); //(에코)

        // 들어온 메세지의 sender와 value 구분해서 처리
        const obj = JSON.parse(msg);
        // sender: obj.sender, value: obj.value

        // 분기할 조건 이거 밖에 없는 거 맞나?
        if(obj.value === "MATCH_START") {
            client.id = id;
            mapUsernameAndId.set(obj.sender, id);
            console.log(mapUsernameAndId);
            id++;

            // start quiz num 1
            showQuiz();

        } else if(obj.value === "BUZZER") {
            onClickBuzzer(obj.sender); 
            console.log(obj.sender + ' pushed buzzer!')

        } else {
            // sender가 지금 정답 입력중인 유저 맞는지 한 번 더 체크하고
            if(answeringUserName === obj.sender){
                checkAnswerSequencely(obj.value);
            }
        }
        
    });

    client.on('close', () => console.log('Client disconnected'));
});

// 서버 메세지 전송
function sendServerMsg(msgToSend, targetUsername, isExcept){
    // 모든 클라이언트들에게 전송
    if(targetUsername === "all"){
        for(var cl of wss.clients) {
            cl.send(msgToSend);
        }
    } else {
        if(isExcept){
            // targetUsername 빼고 나머지 사람들에게

        } else {
            for(var cl of wss.clients) {
                console.log('cl.id: '+cl.id+', mapUsernameAndId.get(targetUsername): '+mapUsernameAndId.get(targetUsername));
                if(cl.id == mapUsernameAndId.get(targetUsername)){
                    cl.send(msgToSend);
                }
            }
        }
    }
    
    console.log('server send: '+msgToSend + ", to: "+targetUsername);
}

function showQuiz() {
    answeringUserName = "none";
    curAnswerSequence = 0;
    // set new quiz data
    msg = quiz1;
    // send new quiz data to all
    sendServerMsg(msg, "all")
}



// 플레이어가 정답 부저를 눌렀을 때 처리 로직
function onClickBuzzer(usernameBuzzerPushed) {
    if(answeringUserName === "none"){
        // 아직 대답 중인 플레이어가 없을 때 

        answeringUserName = usernameBuzzerPushed;
        console.log('now answering: '+answeringUserName);

        // send msg to player to answer 
        let serverMsgToTurn = '{"sender": "server", "target": "'+answeringUserName+'", "command": "YOUR_TURN", "value": ""}';
        sendServerMsg(serverMsgToTurn, answeringUserName);

        // send msg to player who CAN'T answer
        let serverMsgToNotTurn = '{"sender": "server", "target": "'++'", "command": "OPPONENT_TURN", "value": ""}';
        sendServerMsg(serverMsgToNotTurn, );

    } else if (answeringUserName === usernameBuzzerPushed) {
        // 내가 다시 버즈를 누르는 경우 (비정상적인 경우 대비)
        console.log('비정상적인 경우');

    } else {
        // 대답 중인 플레이어가 있을 때 (이것도 비정상적인 경우임)

        // send msg to the player who pushed buzzer in late
        let serverMsg = '{"sender": "server", "target": "'+usernameBuzzerPushed+'", "command": "OPPONENT_TURN"}';
        sendServerMsg(serverMsg, usernameBuzzerPushed);
    }
}

// 플레이어가 정답을 순서대로 누르고 있는지 판단하는 로직
function checkAnswerSequencely(playerAnswer) {
    // quiz1_answer is "4321"

    // 현재 퀴즈의 정답을 분해해서 정답 시퀀스에 넣고
    answerSequence = [];
    Array.prototype.push.apply(answerSequence, quiz1_answer.split(''));
    console.log(answerSequence);

    // 현재 시퀀스의 글자와 정답시퀀스와 비교
    if(answerSequence[curAnswerSequence] === playerAnswer){
        // 정답일 때 처리로직

        if(curAnswerSequence+1 === answerSequence.length){
            // 마지막 시퀀스이면 
            console.log("player "+answeringUserName+" CORRECT!");

            // 스코어 ++
            // send players msg
            showQuiz();
        } else {
            curAnswerSequence++;
            // send the answering player msg to go next sequence
            let serverMsg = '{"sender": "server", "target": "'+answeringUserName+'", "command": "NEXT_SEQUENCE"}';
            sendServerMsg(serverMsg);
        }
        
    } else {
        // 틀렸을 때 처리
        console.log("player "+answeringUserName+" WRONG!");

        // send msg to players that all you can answer
        let msg = '{"sender": "server", "target": "all", "command": "NONE_TURN", "value": ""}';
        sendServerMsg(msg, "all");
        
        answeringUserName = "none";
    }

    return true;
}
