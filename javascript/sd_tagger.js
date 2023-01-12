let onPageLoad = () => {
    let tg = gradioApp().querySelector("#tag_list");
    let tgli = gradioApp().querySelector("#tag_list_inner");
    let tb = gradioApp().querySelector("#example_tag");
    let td = gradioApp().querySelector("#tags_data textarea");
    let dt = gradioApp().querySelector("#display_tags textarea");
    let st = gradioApp().querySelector("#save_tags");
    let ts = gradioApp().querySelector("#tag_search");

    let on = (button) => {
        if(!button.classList.contains("gr-button-primary"))
            button.classList.add("gr-button-primary");
    }

    let off = (button) => {
        button.classList.remove("gr-button-primary");
    }

    let refreshTags = () => {
        console.log("Refresh Tags...");
        
        if(!td.value)
            return;

        ts.value = ""; // Reset Search
        tgli.innerHTML = ""; // Remove Buttons

        tags = JSON.parse(td.value.replaceAll("\'", "\""));
        for (let i = 0; i < tags.length; i++) {
            let tagButton = tb.cloneNode(true);
            tagButton.id = "";
            tagButton.innerText = tags[i];
            tagButton.onclick = () => {
                if (tagButton.classList.contains("gr-button-primary")) {
                    tagButton.classList.remove("gr-button-primary");
                    if(dt.value) {
                        let split = dt.value.split(", ");
                        dt.value = split.filter(tag => tag !== tagButton.innerText).join(", ");
                    }
                } else {
                    tagButton.classList.add("gr-button-primary");
                    if(dt.value) {
                        dt.value = dt.value + ", " + tagButton.innerText;
                    } else {
                        dt.value = tagButton.innerText;
                    }
                }
                dt.dispatchEvent(new CustomEvent("input", {}));
                st.click();

            };
            tagButton.classList.remove("d-none");
            tgli.appendChild(tagButton);
        }
    }

    let readTags = () => {
        split = dt.value.split(",").map((s) => {
            return s.trim();
        });

        let buttons = tgli.childNodes;
        for(let i = 0; i < buttons.length; i++) {
            if(split.includes(buttons[i].innerText))
                on(buttons[i]);
            else
                off(buttons[i]);
        }
    }

    lastSearch = ts.value.toLowerCase();
    setInterval(() => {
        if(lastSearch != ts.value.toLowerCase()) {
            text = ts.value.toLowerCase();
            let buttons = tgli.childNodes;
            for(let i = 0; i < buttons.length; i++) {
                if(buttons[i].innerText.toLowerCase().startsWith(text)) {
                    buttons[i].style.display = "";
                } else {
                    buttons[i].style.display = "none";
                }
            }
            lastSearch = text
        }
    }, 250);

    lastText = td.value;
    setInterval(() => {
        if(lastText != td.value) {
            refreshTags();
            readTags();
            lastText = td.value;
        }
    }, 1000);

    lastTextDisplayTags = dt.value;
    setInterval(() => {
        if(lastTextDisplayTags != dt.value) {
            readTags();
            lastTextDisplayTags = dt.value;
        }
    }, 250);
}

let interval = setInterval(() => {
    let tg = gradioApp().querySelector("#tag_list");
    if(tg) {
        onPageLoad();
        clearInterval(interval);
    }
}, 1000);