"use strict";

export function toggleAllButtons(disabled){
    for (let button of document.querySelectorAll("#menu>button")) button.disabled = disabled;
}

export function clearDemoBox(){
    let demoBox = document.getElementById("demoBox");
    while(demoBox.lastElementChild) demoBox.lastElementChild.remove();
}