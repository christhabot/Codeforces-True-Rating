(function () {

  function log(...args) {
    console.log("[CF-PageJS]", ...args);
  }

  function whenJQ(cb) {
    if (window.jQuery) return cb();
    const iv = setInterval(() => {
      if (window.jQuery) {
        clearInterval(iv);
        cb();
      }
    }, 100);

  }

  whenJQ(() => {
    const $ = window.jQuery;

    let lastRun = 0;
    const RUN_DEBOUNCE_MS = 300;

    function cloneCurrentCFGraph() {
      try {

        const now = Date.now();
        if (now - lastRun < RUN_DEBOUNCE_MS) {
          return;
        }
        lastRun = now;

        $("#usersRatingGraphPlaceholderClone").remove();

        $(".graph-title").filter((i, el) => (el.textContent || "").includes("True Rating")).remove();

        $(".zoomTip").filter((i, el) => (el.previousElementSibling && el.previousElementSibling.id === "usersRatingGraphPlaceholderClone")).remove();

        let original = $("#usersRatingGraphPlaceholder");
        if (!original.length) return console.error("Original CF graph not found!");

        let originalPlot = original.data("plot");
        if (!originalPlot) return console.error("No Flot plot found on original graph!");

        let datas = originalPlot.getData();
        if (!datas.length || !datas[0].data || datas[0].data.length === 0) {
            console.log("graph is empty, skipping");
            return;
        }
        let totalValuesCount = datas.length && datas[0].data ? datas[0].data.length : 0;
        console.log("Total data points in original graph:", totalValuesCount);
        let firstTotal = datas[0].data[0][1];
        let firstChange = datas[0].data[0][5] || 0;

        let shouldModify = (firstTotal - firstChange === 0);

        if (!original.prev().hasClass("graph-title")) {
            $('<div class="graph-title" style="text-align: center; font-weight: bold; font-size: 18px; margin-top: 20px; margin-bottom: 10px;">Displayed Rating</div>')
                .insertBefore(original);
        }

        let clone = original.clone();
        clone.attr("id", "usersRatingGraphPlaceholderClone");
        clone.css("margin-bottom", "20px");

        let cloneTitle = $('<div class="graph-title" style="text-align: center; font-weight: bold; font-size: 18px; margin-top: 20px; margin-bottom: 10px;">True Rating</div>');
        cloneTitle.insertAfter(original);
        clone.insertAfter(cloneTitle);

        let options = $.extend(true, {}, originalPlot.getOptions()); 

        function getRankTitle(rating) {
            if (!rating && rating !== 0) return "";
            rating = Number(rating);
            if (isNaN(rating)) return "";
            if (rating < 1200) return "newbie";
            if (rating < 1400) return "pupil";
            if (rating < 1600) return "specialist";
            if (rating < 1900) return "expert";
            if (rating < 2100) return "candidate master";
            if (rating < 2300) return "master";
            if (rating < 2400) return "international master";
            if (rating < 2600) return "grandmaster";
            if (rating < 3000) return "international grandmaster";
            return "legendary grandmaster";
        }

        let increments = [900, 550, 300, 150, 50];

        if (shouldModify) {
            datas = datas.map(series => {
                let newData = [];

                for (let idx = 0; idx < (series.data ? series.data.length : 0); idx++) {
                    let point = series.data[idx];

                    if (!Array.isArray(point)) {
                        newData.push(point);
                        continue;
                    }
                    let modified = Array.from(point);

                    if (idx < 5) {
                        modified[1] = (modified[1] || 0) + increments[idx];

                        if (idx === 0) {
                            modified[5] = modified[1] - 1400; 
                        } else {
                            modified[5] = modified[1] - (newData[idx - 1] ? newData[idx - 1][1] : 0); 
                        }

                        modified[8] = getRankTitle(modified[1]);
                    } else if (idx === 5) {
                        modified[5] = modified[1] - (newData[idx - 1] ? newData[idx - 1][1] : 0);
                    }

                    newData.push(modified);
                }

                return {...series, data: newData};
            });
        }

        const REQUIRED_FIELDS = [0, 1, 3, 5, 6, 7, 8, 12]; 

        datas = datas.map(series => {
            let cleaned = (series.data || []).filter(point => {
                if (!Array.isArray(point)) return false;

                for (const idx of REQUIRED_FIELDS) {
                    if (point[idx] === undefined || point[idx] === null) return false;
                }

                return true;
            });

            return { ...series, data: cleaned };
        });

        let clonePlot = $.plot(clone, datas, options);

        let prev = -1;
        clone.unbind("plothover").bind("plothover", function(event, pos, item){
            if(item && prev !== item.dataIndex){
                $("#tooltipClone").remove();
                let params = datas[item.seriesIndex].data[item.dataIndex];
                let total = params[1];
                let change = params[5] > 0 ? "+" + params[5] : params[5];
                let rank = params[6];
                let contestName = params[3];
                let html = "= " + total + " (" + change + "), " + params[8] + "<br/>" +
                           (rank>=0 ? "Rank: " + rank + "<br/>" : "") +
                           `<a href='${params[7]}'>${contestName}</a><br>` + params[12];
                $('<div id="tooltipClone"></div>').html(html)
                    .css({position:'absolute', top:item.pageY-20, left:item.pageX+10, border:'1px solid #fdd', padding:'2px', 'font-size':'11px', 'background-color':'#fee', opacity:0.8})
                    .appendTo("body").fadeIn(200);
                prev = item.dataIndex;
                setTimeout(()=>{ $("#tooltipClone").fadeOut(200); prev = -1; },4000);
            }
        });

        if (!clone.next('.zoomTip').length) {
            $('<div class="zoomTip" style="display:none; text-align:center; font-size:12px; color:#999; margin-top:5px;">Click the graph to enable zoom and pan</div>')
                .insertAfter(clone);
        }

        clone.click(function() {
            options.zoom = {interactive: true};
            options.pan = {interactive: true};

            clonePlot = $.plot(clone, datas, options);

            clone.bind("plotpan plotzoom", function(event, plot) {
                var axes = plot.getAxes();
                plot.getOptions().xaxes[0].min = axes.xaxis.min;
                plot.getOptions().xaxes[0].max = axes.xaxis.max;
                plot.getOptions().yaxes[0].min = axes.yaxis.min;
                plot.getOptions().yaxes[0].max = axes.yaxis.max;
                plot.setupGrid();
                plot.draw();
            });

            clone.unbind("click");
            clone.next('.zoomTip').fadeOut();
        });

        var wheelEventsCount = 0;

        if (typeof clone.mousewheel === "function") {
          clone.mousewheel(function() {
              wheelEventsCount += 1;
              if (wheelEventsCount > 3) {
                  clone.next('.zoomTip').fadeIn();
                  clone.off("mousewheel");
              }
          });
        } else if (typeof clone.on === "function") {

          clone.on("wheel.cloneHint", function() {
            wheelEventsCount += 1;
            if (wheelEventsCount > 3) {
              clone.next('.zoomTip').fadeIn();
              clone.off("wheel.cloneHint");
            }
          });
        }

        $(window).off("resize.clonePlot").on("resize.clonePlot", function() {
            if (clonePlot && typeof clonePlot.resize === "function") {
                try {
                    clonePlot.resize();
                    clonePlot.setupGrid();
                    clonePlot.draw();
                } catch (e) {
                    console.warn("Error resizing clonePlot:", e);
                }
            }
        });

        const li = Array.from(document.querySelectorAll('li'))
            .find(el => el.textContent.includes("Contest rating"));

        if (!li) return console.error("Rating li not found!");

        let existingCloneLi = li.nextElementSibling && li.nextElementSibling.textContent && li.nextElementSibling.textContent.includes("True Contest Rating");
        if (!existingCloneLi) {
            const clone2 = li.cloneNode(true);
            li.parentNode.insertBefore(clone2, li.nextSibling);

        }

        const clone2 = li.nextElementSibling;

        function replaceTextNode(el, newText) {
            for (const node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== "") {
                    node.textContent = newText + " ";
                    break;
                }
            }
        }

        replaceTextNode(li, "Displayed Contest Rating: ");
        if (clone2) replaceTextNode(clone2, "True Contest Rating: ");
        const rankColors = {
                "legendary grandmaster": "#FF1A1A",
                "international grandmaster": "#FF1A1A",
                "grandmaster": "#FF1A1A",
                "international master": "#FF981A",
                "master": "#FF981A",
                "candidate master": "#FF55FF",
                "expert": "#337DFF",
                "specialist": "#57FCF2",
                "pupil": "#72FF72",
                "newbie": "#988F81"
            };
        let RatingTrue = 1;
        function replaceRatings(liElement, rank1, Rating, rank2, maxRating) {
            if (!liElement) return;
            const boldSpans = liElement.querySelectorAll('[style="font-weight:bold;"]');
            if (boldSpans.length >= 2) {
                // Extract current rating from first bold span
                const currentRatingText = boldSpans[0].textContent.trim();
                
                if(rank1 === "") {
                    rank1 = getRankTitle(parseInt(currentRatingText));
                }
                if(Rating === "") {
                    Rating = currentRatingText;  // Use the first bold span's value
                }
                
                const mainRatingSpan = boldSpans[0];
                mainRatingSpan.textContent = rank1;
                
                const color = rankColors[rank1.toLowerCase()];
                if (color) {
                    mainRatingSpan.style.cssText = `font-weight:bold; color:${color} !important;`;
                }
                
                if (Rating !== "") {
                    const extraSpan = document.createElement('span');
                    extraSpan.style.cssText = mainRatingSpan.style.cssText;
                    extraSpan.textContent = ', ' + Rating;
                    mainRatingSpan.parentNode.insertBefore(extraSpan, mainRatingSpan.nextSibling);
                }
                
                let rank2Color = null;
                if (rank2 !== "") {
                    boldSpans[1].textContent = rank2;
                    rank2Color = rankColors[rank2.toLowerCase()];
                    if (rank2Color) {
                        boldSpans[1].style.cssText = `font-weight:bold; color:${rank2Color} !important;`;
                    }
                }
                
                if (maxRating !== "") {
                    boldSpans[boldSpans.length - 1].textContent = maxRating;
                    if (rank2Color) {
                        boldSpans[boldSpans.length - 1].style.cssText = `font-weight:bold; color:${rank2Color} !important;`;
                    }
                }
            }
        }

        let cloneDatas = clonePlot.getData();
        let maxTotal = -Infinity;
        let maxRank = null;
        let lastTotal = null;
        let lastRank = null;

        cloneDatas.forEach(series => {
            series.data.forEach((point, idx) => {
                if (point[1] > maxTotal) {
                    maxTotal = point[1];
                    maxRank = point[8]; 
                }
                if (idx === series.data.length - 1) {
                    lastTotal = point[1];
                    lastRank = point[8];
                }
            });
        });

        replaceRatings(clone2, getRankTitle(lastTotal), String(lastTotal), getRankTitle(maxTotal), String(maxTotal));
        replaceRatings(li, "", "", "", "");

        const userRankElem = document.querySelector('.user-rank');

        if (userRankElem && getRankTitle(parseInt(RatingTrue)) !== getRankTitle(lastTotal)) {
            const originalRank = getRankTitle(parseInt(RatingTrue));
            const trueRank = getRankTitle(lastTotal);

            const originalColor = rankColors[originalRank.toLowerCase()];
            const trueColor = rankColors[trueRank.toLowerCase()];

            userRankElem.style.color = originalColor;

            if (originalRank !== trueRank) {
                userRankElem.innerHTML +=
                    ` <span style="color:${trueColor}">(truly ${trueRank})</span>`;
            }
        }

      } catch (err) {
        console.error("cloneCurrentCFGraph error:", err);
      }
    } 

    function waitForGraphAndRun() {
      const original = $("#usersRatingGraphPlaceholder");
      const plot = original && original.data ? original.data("plot") : null;
      if (original && original.length && plot) {
        cloneCurrentCFGraph();
        return;
      }

      const check = setInterval(() => {
        const o = $("#usersRatingGraphPlaceholder");
        const p = o && o.data ? o.data("plot") : null;
        if (o && o.length && p) {
          clearInterval(check);
          cloneCurrentCFGraph();
        }
      }, 200);
    }

    waitForGraphAndRun();

    const docRoot = document.documentElement || document.body || document;
    const mutationObserver = new MutationObserver((mutations) => {

      if (Date.now() - lastRun < RUN_DEBOUNCE_MS) return;

      setTimeout(() => {
        waitForGraphAndRun();
      }, 150);
    });

    mutationObserver.observe(docRoot, {
      childList: true,
      subtree: true
    });

    window.__cloneCF = {
      run: cloneCurrentCFGraph,
      stopObserver: () => mutationObserver.disconnect()
    };

    log("page.js loaded and observer started.");
  }); 

})();

