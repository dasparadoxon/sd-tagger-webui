let observeProperty = (obj, property, callback, time = 250, compare) => {
    let initial = obj[property];
    setInterval(() => {
        let now = obj[property];
        if(compare) {
            if(compare(initial, now)) {
                callback(now);
            }
        } else {
            if(initial !== now) {
                callback(now);
            }
        }
        initial = now;
    }, time);
}

let onPageLoad = () => {

    // Load all the elements we'll need

    // Internal Gradio Elements (Invisible)
    // These will be used to transfer data back to gradio
    // TODO Looking for other solutions rather than using invisible gradio elements
    let availableTags = gradioApp().querySelector("#available_tags textarea");
    let draftTags = gradioApp().querySelector("#draft_tags textarea");
    let cropData = gradioApp().querySelector("#crop_data textarea");
    let cropBtn = gradioApp().querySelector("#crop_button");
    let reloadTagsListGradioBtn = gradioApp().querySelector("#reload_tags_list_button");

    // Display
    let display = gradioApp().querySelector("#display");
    let displayHTML = gradioApp().querySelector("#display_html");
    let cropper = gradioApp().querySelector("#cropper");
    let image;
    let resizeDisplayBtn = gradioApp().querySelector("#resize_display");
    let displayLog = gradioApp().querySelector("#display_log");

    // Display Tags
    let displayTags = gradioApp().querySelector("#display_tags textarea");

    // Tags List
    let tagsList = gradioApp().querySelector("#tags_list");
    let tagTemplate = gradioApp().querySelector("#tag_template");
    let tagsListSearch = gradioApp().querySelector("#tags_list_search");
    let tagsListPreviousPageBtn = gradioApp().querySelector("#tags_list_previous_page");
    let tagsListNextPageBtn = gradioApp().querySelector("#tags_list_next_page");
    let tagsListPageIndex = gradioApp().querySelector("#tags_list_page_index");
    let reloadTagsListBtn = gradioApp().querySelector("#reload_tags_list");
    let clearTagsBtn = gradioApp().querySelector("#clear_tags");
    let revertTagsBtn = gradioApp().querySelector("#revert_tags");
    let tagsListLog = gradioApp().querySelector("#tags_list_log");

    // Misc
    let interrogateBtn = gradioApp().querySelector("#interrogate_button");

    // Settings
    let cropperSnapSetting = gradioApp().querySelector("#setting_cropper_snap input");
    let autoInterrogateSetting = gradioApp().querySelector("#setting_auto_interrogate input");
    let maxTagsSetting = gradioApp().querySelector("#setting_max_tag_count input");
    let highlightDupesSetting = gradioApp().querySelector("#setting_highlight_duplicate input");
    let openWikiSetting = gradioApp().querySelector("#setting_open_tag_wiki input");

    // Internal Variables
    let crop = {};
    let shiftKey = false;
    let lastX, lastY;
    let originalTags;
    let tagsPage = 0;
    let numTagsPages = 0;

    let setupDisplayResizeBtn = () => {
        let displayBounds = display.getBoundingClientRect();

        let drag = false;
        let downY = 0;

        document.addEventListener("mousemove", (e) => {
            if(drag) {
                display.style.height = (e.pageY - displayBounds.y + 10) + "px";
            }
        });

        resizeDisplayBtn.onmousedown = (e) => {
            drag = true;
            downY = e.pageY;
        };

        document.addEventListener("mouseup", (e) => {
            drag = false;
        });
    }

    let setupCropper = () => {
        let cancelContext = false;

        let cancel = () => {
            image.pressed = false;
            image.press_x = undefined;
            image.press_y = undefined;
        };

        document.addEventListener("mousemove", (e) => {
            cropperUpdate(e.pageX, e.pageY);
            lastX = e.pageX;
            lastY = e.pageY;
        });

        document.addEventListener("mouseup", (e) => {
            if(e.button === 0) {
                if(image.pressed) {
                    // Send for Crop
                    cropData.value = JSON.stringify(crop);
                    cropData.dispatchEvent(new CustomEvent("input", {}));
                    cropBtn.click();
                }
                cancel();
            }
        });

        document.addEventListener("mousedown", (e) => {
            if(e.button === 2 && image.pressed) {
                cancel();
                cancelContext = true;
            }
        });

        document.addEventListener("contextmenu", (e) => {
            if(cancelContext) {
                e.preventDefault();
                cancelContext = false;
                return false;
            }
        });

        document.addEventListener("keydown", (e) => {
            if(!shiftKey && e.shiftKey) {
                shiftKey = e.shiftKey
                cropperUpdate(lastX, lastY);
            }
        });

        document.addEventListener("keyup", (e) => {
            if(shiftKey && !e.shiftKey) {
                shiftKey = e.shiftKey
                cropperUpdate(lastX, lastY);
            }
        });

        image.onmouseenter = (e) => {
            image.hovering = true;
        };

        image.onmouseleave = (e) => {
            image.hovering = false;
        };

        let tiMouseDown = (e) => {
            image.pressed = true;
            image.press_x = e.pageX;
            image.press_y = e.pageY;
        };

        image.onmousedown = (e) => tiMouseDown(e);

        // Edge case: include cropping rectangle with mousedown
        cropper.onmousedown = (e) => tiMouseDown(e);

    }

    let cropperUpdate = (mouseX, mouseY) => {
        let bound = image.getBoundingClientRect();

        cropper.style.display = image.pressed ? "block" : "none";
        //croppingRect.style.display = ti.hovering ? "block" : "none"; // Another mode

        if(image.pressed) {
            // Calculate relative image coordinates for rectangle
            let x = image.press_x - bound.x - pageXOffset;
            let y = image.press_y - bound.y - pageYOffset;
            let width = Math.abs(mouseX - image.press_x);
            let height = Math.abs(mouseY - image.press_y);

            // How much the image is zoomed in
            let zoomRatio = image.naturalWidth / bound.width;

            // Snapping
            let snap = cropperSnapSetting.value * (1 / zoomRatio);

            width = Math.round(width / snap) * snap;
            height = Math.round(height / snap) * snap;

            if(shiftKey)
                if(width >= height)
                    height = width;
                else
                    width = height;

            // Realign to top-left corner of rectangle if we're cropping backwards
            let dx = (mouseX - bound.x) - x;
            let dy = (mouseY - bound.y) - y;

            if(dx < 0) {
                x -= width;
            }
            if(dy < 0) {
                y -= height;
            }

            // Check image borders
            if(x < 0) {
                width += x;
                x = 0;
            }
            if(y < 0) {
                height += y;
                y = 0;
            }

            let endX = x + width;
            let endY = y + height;

            if (endX > bound.width)
                width = width - (endX - bound.width)
            if (endY > bound.height)
                height = height - (endY - bound.height)

            // Update visual
            cropper.style.left = x + "px";
            cropper.style.top = y + "px";
            cropper.style.width = width + "px";
            cropper.style.height = height + "px";

            // Update image size text
            if(width > 0 && height > 0) {
                cropper.style.padding = "5px";
                cropper.innerText = Math.ceil(width * zoomRatio) + "x" + Math.ceil(height * zoomRatio);
            } else {
                cropper.style.padding = "0px";
                cropper.innerText = "";
            }

            crop = {
                x1: Math.floor(x * zoomRatio),
                y1: Math.floor(y * zoomRatio),
                x2: Math.floor((x + width) * zoomRatio),
                y2: Math.floor((y + height) * zoomRatio)
            };
        }
    }

    // Reload the tags from the gradio tag data (e.g. tags were loaded from txt file)
    let reloadTags = () => {

        tagsList.innerHTML = ""; // Remove Buttons

        // If no tags found
        if(!availableTags.value)
            return;

        let tags = availableTags.value.split(",");

        // Prune tags based on search
        tags = tags.filter((t) => t.toLowerCase().includes(tagsListSearch.value.toLowerCase()))

        // Number of tag pages
        numTagsPages = Math.floor(tags.length / maxTagsSetting.value) + 1;

        if(numTagsPages > 1) {
            if(tagsPage === 0) {
                tagsListPreviousPageBtn.disabled = true;
                tagsListNextPageBtn.disabled = false;
            } else if(tagsPage >= numTagsPages - 1) {
                tagsListPreviousPageBtn.disabled = false;
                tagsListNextPageBtn.disabled = true;
            } else {
                tagsListPreviousPageBtn.disabled = false;
                tagsListNextPageBtn.disabled = false;
            }
            tagsListPageIndex.disabled = false;
        } else {
            tagsListPreviousPageBtn.disabled = true;
            tagsListNextPageBtn.disabled = true;
            tagsListPageIndex.disabled = true;
        }

        let tagCount = 0;

        for (let i = tagsPage * maxTagsSetting.value; i < tags.length; i++) {
            // Maximum tag count
            if(tagCount > maxTagsSetting.value)
                break;

            let tagButton = tagTemplate.cloneNode(true);
            tagButton.id = "";
            tagButton.innerText = tags[i];
            tagButton.onmousedown = (e) => {
                if(e.button === 1) {
                    if(openWikiSetting.checked) {
                        window.open("https://danbooru.donmai.us/wiki_pages/" + tagButton.innerText.replaceAll(" ", "_"), '_blank');
                        return false;
                    }
                }
            }
            tagButton.onclick = (e) => {
                if (tagButton.classList.contains("gr-button-primary")) {
                    tagButton.classList.remove("gr-button-primary");
                    if(displayTags.value) {
                        let split = displayTags.value.split(",").map((s) => {
                            return s.trim();
                        });
                        displayTags.value = split.filter(tag => tag !== tagButton.innerText).join(", ");
                    }
                } else {
                    tagButton.classList.add("gr-button-primary");
                    if(displayTags.value) {
                        displayTags.value = displayTags.value + ", " + tagButton.innerText;
                    } else {
                        displayTags.value = tagButton.innerText;
                    }
                }
                displayTags.dispatchEvent(new CustomEvent("input", {}));
            };
            tagButton.classList.remove("d-none");
            tagsList.appendChild(tagButton);
            tagCount++;
        }

        let hidden = tags.length - maxTagsSetting.value
        if(tags.length > 0)
            tagsListLog.innerText = (tagsPage + 1) + "/" + numTagsPages + " Pages " + tags.length + " Tags" + ((hidden > 0) ? " (" + hidden + " hidden)" : "");
        else
            tagsListLog.innerText = "No Tags Loaded";
    }

    // Update the tag states (e.g. when switching images)
    let updateTags = () => {
        let split = displayTags.value.split(",").map((s) => {
            return s.trim();
        });

        let buttons = tagsList.getElementsByTagName("button");

        // Return if buttons not loaded
        if(buttons.length === 0)
            return;

        for(let i = 0; i < buttons.length; i++) {
            let occurrence = split.reduce((n, str) => {
                return n + (str === buttons[i].innerText);
            }, 0);

            if(occurrence > 0) {
                if (!buttons[i].classList.contains("gr-button-primary")) {
                    buttons[i].classList.add("gr-button-primary");
                }
            } else {
                buttons[i].classList.remove("gr-button-primary");
            }

            if(occurrence > 1 && highlightDupesSetting.checked) {
                buttons[i].style.color = "red";
                buttons[i].style.backgroundColor = "red";
            } else {
                buttons[i].style.color = "";
                buttons[i].style.backgroundColor = "";
            }
        }
    }

    let updateDisplayTags = () => {
        displayTags.value = draftTags.value;
    }

    let sendDisplayUpdate = () => {
        draftTags.value = displayTags.value;
        draftTags.dispatchEvent(new CustomEvent("input", {}));
    }

    let onImageChange = () => {
        updateTags();
    }

    let setupTagsList = () => {

        let verifyPageReload = () => {
            if(tagsPage < 0)
                tagsPage = 0;
            if(tagsPage >= numTagsPages)
                tagsPage = numTagsPages - 1;

            tagsListPageIndex.value = tagsPage + 1;
            reloadTags()
            updateTags();
        };

        tagsListPreviousPageBtn.onclick = () => {
            tagsPage--;
            verifyPageReload();
        };

        tagsListNextPageBtn.onclick = () => {
            tagsPage++;
            verifyPageReload();
        };

        let pageIndexDelay;
        tagsListPageIndex.oninput = (e) => {
            let num = parseInt(tagsListPageIndex.value);
            if(Number.isInteger(num)) {
                tagsPage = num - 1;
                verifyPageReload();
            }
        };

        tagsListSearch.oninput = (e) => {
            tagsPage = 0;
            tagsListPageIndex.value = "";
            reloadTags();
            updateTags();
        };

        reloadTagsListBtn.onclick = () => {
            reloadTagsListGradioBtn.click();
            reloadTags();
            updateTags();
        };

        clearTagsBtn.onclick = () => {
            displayTags.value = "";
            updateTags();
            sendDisplayUpdate();
        };

        revertTagsBtn.onclick = () => {
            displayTags.value = originalTags;
            updateTags();
            sendDisplayUpdate();
        };
    }

    let setupDisplay = () => {
        let move = gradioApp().querySelector("#display_image_to_move");
        let di = gradioApp().querySelector("#display_image_to_move img");
        let display_inner = gradioApp().querySelector("#display div");

        display_inner.appendChild(di);

        image = gradioApp().querySelector("#display img");

        displayHTML.style.display = "block";

        image.classList.remove("w-full");
        image.classList.add("h-full");
        image.classList.add("no-interact");
    }

    setupDisplay();
    setupDisplayResizeBtn()
    setupCropper();
    setupTagsList();

    // When tag data get updated (invisible element)
    observeProperty(availableTags, "value", () => {
        reloadTags();
        updateTags();
    }, 1000);

    // When tags are being typed
    displayTags.oninput = () => {
        updateTags();
        sendDisplayUpdate();
    };

    // When the invisible tags box is changed
    observeProperty(draftTags, "value", () => {
        updateDisplayTags();
        updateTags();
    }, 250);

    // Image Change
    observeProperty(displayLog, "innerText", () => {
        onImageChange();

        // Save original tags
        originalTags = displayTags.value;

        if(autoInterrogateSetting.checked)
            interrogateBtn.click()
    }, 250);
}

let interval = setInterval(() => {
    let di = gradioApp().querySelector("#display_image_to_move img")

    // Hide the display box until we can move the image into it.
    gradioApp().querySelector("#display_html").style.display = "none";

    if(di) {
        onPageLoad();
        clearInterval(interval);
    }
}, 1000);