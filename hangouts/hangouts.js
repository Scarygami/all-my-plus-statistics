(function (global) {
  "use strict";
  var
    allmyplus,
    client,
    apikey = "<YOUR API KEY>",
    doc = global.document,
    con = global.console;

  function addEvent(html_element, event_name, event_function) {
    if (html_element.attachEvent) {
      html_element.attachEvent("on" + event_name, function () {
        event_function.call(html_element);
      });
    } else if (html_element.addEventListener) {
      html_element.addEventListener(event_name, event_function, false);
    }
  }

  Date.prototype.yyyymmddhhmmss = function () {
    var y, m, d, h, min, sec;
    y = this.getFullYear().toString();
    m = (this.getMonth() + 1).toString();
    d  = this.getDate().toString();
    h = this.getHours().toString();
    min = this.getMinutes().toString();
    sec = this.getSeconds().toString();
    return y + (m[1] ? m : "0" + m[0]) + (d[1] ? d : "0" + d[0]) + (h[1] ? h : "0" + h[0]) + (min[1] ? min : "0" + min[0]) + (sec[1] ? sec : "0" + sec[0]);
  };

  Date.prototype.nice_date = function () {
    var y, m, d, h, min, sec;
    y = this.getFullYear().toString();
    m = (this.getMonth() + 1).toString();
    d  = this.getDate().toString();
    h = this.getHours().toString();
    min = this.getMinutes().toString();
    sec = this.getSeconds().toString();
    return y + "-" + (m[1] ? m : "0" + m[0]) + "-" + (d[1] ? d : "0" + d[0]) + " " + (h[1] ? h : "0" + h[0]) + ":" + (min[1] ? min : "0" + min[0]) + ":" + (sec[1] ? sec : "0" + sec[0]);
  };

  function AllMyPlus() {

    var fileCount = 0, dropZone, convoDataTable, progress, conversations = [], people = [], groupedConversations = {};

    function lookupPerson(id) {
      var i;
      for (i = 0; i < people.length; i++) {
        if (people[i].id === id) {
          return people[i];
        }
      }
      return undefined;
    }

    function hideUI() {
      var i, tmp;

      progress.style.display = "block";
      dropZone.style.display = "none";
      doc.getElementById("stat_types").style.display = "none";
      tmp = doc.querySelectorAll(".recalculate, .combine");
      for (i = 0; i < tmp.length; i++) {
        tmp[i].style.display = "none";
      }
    }

    function showUI() {
      var i, tmp;
      progress.style.display = "none";
      dropZone.style.display = "block";
      if (conversations.length > 0) {
        tmp = doc.querySelectorAll(".recalculate, .menue, .contents, .anchor");
        for (i = 0; i < tmp.length; i++) {
          tmp[i].style.display = "block";
        }
        doc.getElementById("instructions").style.display = "none";
        doc.getElementById("stat_types").style.display = "block";
        tmp = doc.getElementsByClassName("stat_type");
        for (i = 0; i < tmp.length; i++) {
          tmp[i].className = "stat_type";
        }
        dropZone.innerHTML = "Drop more files here";
      }
    }

    function fetchPeople(cb) {
      var i, person;
      for (i = 0; i < people.length; i++) {
        if (!people[i].api_data && !people[i].fetching) {
          person = people[i];
          break;
        }
      }
      if (!!person) {
        person.fetching = true;
        client.plus.people.get({"userId": person.id, "fields": "displayName,image"}).execute(function (data) {
          person.api_data = true;
          if (!!data.error) {
            person.api_error = true;
          } else {
            person.displayName = data.displayName;
            person.image = data.image.url;
          }
          person.fetching = false;
        });
        global.setTimeout(function () { fetchPeople(cb); }, 10);
      } else {
        cb();
      }
    }

    function finalize() {
      fetchPeople(function () {
        showUI();
      });
    }

    function niceStatus(status) {
      switch (status) {
      case "INVITED":
        return "Invited";
      case "ACTIVE":
        return "Active";
      }
      return status;
    }

    function niceType(type) {
      switch (type) {
      case "GROUP":
        return "Group";
      case "STICKY_ONE_TO_ONE":
        return "One-to-one";
      }
      return type;
    }

    function handleConvo(data) {
      var i, j, conversation, person, words;

      data = data.conversation_state;
      for (i = 0; i < conversations.length; i++) {
        if (conversations[i].id === data.conversation_id.id) {
          return;
        }
      }
      con.log(data);
      conversation = {};
      conversation.id = data.conversation_id.id;
      if (data.conversation.self_conversation_state.view[0] === "ARCHIVED_VIEW") {
        if (data.conversation.self_conversation_state.status === "INVITED") {
          conversation.status = "Never joined";
        } else {
          conversation.status = "Archived";
        }
      } else {
        conversation.status = niceStatus(data.conversation.self_conversation_state.status);
      }
      conversation.type = niceType(data.conversation.type);
      conversation.name = data.conversation.name || "Unnamed Hangout";
      conversation.people = [];

      for (i = 0; i < data.conversation.participant_data.length; i++) {
        person = {};
        for (j = 0; j < people.length; j++) {
          if (people[j].id === (data.conversation.participant_data[i].id.gaia_id || data.conversation.participant_data[i].id.chat_id)) {
            person = people[j];
            break;
          }
        }
        if (!person.id) {
          person.id = data.conversation.participant_data[i].id.gaia_id || data.conversation.participant_data[i].id.chat_id;
          people.push(person);
        }
        if (!person.displayName && !!data.conversation.participant_data[i].fallback_name) {
          person.displayName = data.conversation.participant_data[i].fallback_name;
        }
        conversation.people.push(person.id);
      }

      conversation.messages = 0;
      conversation.words = 0;
      for (i = 0; i < data.event.length; i++) {
        if (!conversation.start || conversation.start > data.event[i].timestamp) {
          conversation.start = data.event[i].timestamp;
        }
        if (!conversation.updated || conversation.updated < data.event[i].timestamp) {
          conversation.updated = data.event[i].timestamp;
        }
        if (!!data.event[i].chat_message) {
          conversation.messages++;
          // can be an attachment instead of a segment:
          // chat_message.message_content.attachment[x].embed_item.type === "PLUS_PHOTO"
          if (!!data.event[i].chat_message.message_content.segment) {
            for (j = 0; j < data.event[i].chat_message.message_content.segment.length; j++) {
              // other types include: LINK, LINE_BREAK
              if (data.event[i].chat_message.message_content.segment[j].type === "TEXT") {
                words = data.event[i].chat_message.message_content.segment[j].text.split(' ').length;
                conversation.words += words;
              }
            }
          }
        }
      }

      conversations.push(conversation);
      doc.getElementById("takeout_status").innerHTML = conversations.length + " conversations loaded";
    }

    function handleFile(f) {
      var reader, i, data;
      reader = new global.FileReader();

      reader.onload = function (eventObj) {
        data = {};
        try {
          data = JSON.parse(eventObj.target.result);
        } catch (ignore) { /* wrong filetype */ }
        if (!!data && !!data.conversation_state && data.conversation_state.length > 0) {
          for (i = 0; i < data.conversation_state.length; i++) {
            handleConvo(data.conversation_state[i]);
          }
        }
        fileCount--;
        if (fileCount === 0) {
          finalize();
        }
      };
      reader.readAsText(f);
    }

    function handleFileSelect(eventObj) {
      var i, l, files;

      eventObj.stopPropagation();
      eventObj.preventDefault();

      hideUI();

      files = eventObj.dataTransfer.files;
      l = files.length;
      for (i = 0; i < l; i++) {
        fileCount++;
        handleFile(files[i]);
      }

      dropZone.className = "";
    }

    function handleDragOver(eventObj) {
      eventObj.stopPropagation();
      eventObj.preventDefault();
      eventObj.dataTransfer.dropEffect = "copy"; // Explicitly show this is a copy.
    }

    function createStatsTable(property, countProperty) {
      var html, tmp_stats, tmp, i;
      html = "<table>";
      tmp_stats = {};
      for (i = 0; i < conversations.length; i++) {
        if (!!countProperty) {
          if (typeof conversations[i][countProperty] == "number") {
            tmp_stats[conversations[i][property]] = (tmp_stats[conversations[i][property]] || 0) + conversations[i][countProperty];
          } else {
            tmp_stats[conversations[i][property]] = (tmp_stats[conversations[i][property]] || 0) + conversations[i][countProperty].length;
          }
        } else {
          tmp_stats[conversations[i][property]] = (tmp_stats[conversations[i][property]] || 0) + 1;
        }
      }
      for (tmp in tmp_stats) {
        if (tmp_stats.hasOwnProperty(tmp)) {
          html += "<tr><td>" + tmp + "</td><td>" + tmp_stats[tmp] + "</td></tr>";
        }
      }
      html += "</table>";
      return html;
    }

    function totalCount(countProperty) {
      var i, count = 0;
      for (i = 0; i < conversations.length; i++) {
        if (typeof conversations[i][countProperty] == "number") {
          count += conversations[i][countProperty];
        } else {
          count += conversations[i][countProperty].length;
        }
      }
      return count;
    }

    function reportOverview() {

      doc.getElementById("c_total").innerHTML = conversations.length;
      doc.getElementById("c_type").innerHTML = createStatsTable("type");
      doc.getElementById("c_status").innerHTML = createStatsTable("status");

      doc.getElementById("p_total").innerHTML = totalCount("people") + "<br><br>(unique " + people.length + ")";
      doc.getElementById("p_type").innerHTML = createStatsTable("type", "people");
      doc.getElementById("p_status").innerHTML = createStatsTable("status", "people");

      doc.getElementById("m_total").innerHTML = totalCount("messages");
      doc.getElementById("m_type").innerHTML = createStatsTable("type", "messages");
      doc.getElementById("m_status").innerHTML = createStatsTable("status", "messages");

      doc.getElementById("stat_overview").className = "stat_type stat_calculated";
      doc.getElementById("overview").getElementsByClassName("recalculate")[0].style.display = "none";

      global.location.hash = "#overview";
    }

    function reportData() {
      var i, j, tr, td, tmp, person;

      convoDataTable.innerHTML = "";
      for (i = 0; i < conversations.length; i++) {
        // store the conversations by the people involved
        var sortedPeople = conversations[i].people.sort();
        if (! (sortedPeople in groupedConversations)) {
          groupedConversations[sortedPeople] = [];
        }
        groupedConversations[sortedPeople].push(conversations[i]);

        tr = doc.createElement("tr");
        td = doc.createElement("td");
        td.innerHTML = conversations[i].name;
        tr.appendChild(td);

        td = doc.createElement("td");
        if (!!conversations[i].start) {
          tmp = new Date(conversations[i].start / 1000);
          td.setAttribute("sorttable_customkey", tmp.yyyymmddhhmmss());
          td.innerHTML = tmp.nice_date();
          td.style.whiteSpace = "nowrap";
        }
        tr.appendChild(td);

        td = doc.createElement("td");
        if (!!conversations[i].updated) {
          tmp = new Date(conversations[i].updated / 1000);
          td.setAttribute("sorttable_customkey", tmp.yyyymmddhhmmss());
          td.innerHTML = tmp.nice_date();
          td.style.whiteSpace = "nowrap";
        }
        tr.appendChild(td);

        td = doc.createElement("td");
        td.innerHTML = conversations[i].status;
        tr.appendChild(td);
        td = doc.createElement("td");
        td.innerHTML = conversations[i].type;
        tr.appendChild(td);
        tmp = conversations[i].people.length + " participants<br>";
        for (j = 0; j < conversations[i].people.length; j++) {
          person = lookupPerson(conversations[i].people[j]);
          if (!!person) {
            tmp += " <a href=\"https://plus.google.com/" + person.id + "\">";
            tmp += "<img alt=\"" + (person.displayName || "unknown") + "\" ";
            tmp += " title=\"" + (person.displayName || "unknown") + "\" ";
            tmp += " src=\"";
            if (!!person.image) {
              tmp += person.image;
            } else {
              tmp += "../images/noimage.png";
            }
            tmp += "\"></a>";
          }
        }
        td = doc.createElement("td");
        td.innerHTML = tmp;
        td.setAttribute("sorttable_customkey", conversations[i].people.length);
        tr.appendChild(td);

        td = doc.createElement("td");
        td.innerHTML = conversations[i].messages;
        tr.appendChild(td);

        td = doc.createElement("td");
        td.innerHTML = conversations[i].words;
        tr.appendChild(td);

        convoDataTable.appendChild(tr);
      }

      global.location.hash = "#data";
      doc.getElementById("stat_data").className = "stat_type stat_calculated";
      doc.getElementById("data").getElementsByClassName("recalculate")[0].style.display = "none";
      doc.getElementById("data").getElementsByClassName("combine")[0].style.display = "block";
    }

    // shows the same table data as reportData() but with each group collapsed to one row
    function combineData() {
      var i, j, tr, td, li, tmp, person, totalMessages, totalWords;
      var tdNames, ulNames, tdStart, ulStart, tdUpdated, ulUpdated, tdStatus, ulStatus;

      // empty table holding the previous individual data
      convoDataTable.innerHTML = "";
      for (var group in groupedConversations) {
        tr = doc.createElement("tr");

        // calculate contents of the name, start/end date, status, and #messages cells simultaneously
        tdNames = doc.createElement("td");
        tdNames.className = "combined_cell";
        ulNames = doc.createElement("ul");
        tdStart = doc.createElement("td");
        tdStart.className = "combined_cell";
        ulStart = doc.createElement("ul");
        tdUpdated = doc.createElement("td");
        tdUpdated.className = "combined_cell";
        ulUpdated = doc.createElement("ul");
        tdStatus = doc.createElement("td");
        tdStatus.className = "combined_cell";
        ulStatus = doc.createElement("ul");
        totalMessages = 0;
        totalWords = 0;
        for (i = 0; i < groupedConversations[group].length; i++) {
          li = doc.createElement("li");
          li.innerHTML = groupedConversations[group][i].name;
          ulNames.appendChild(li);
          if (!!groupedConversations[group][i].start) {
            tmp = new Date(groupedConversations[group][i].start / 1000);
            li = doc.createElement("li");
            li.innerHTML = tmp.nice_date();
            ulStart.appendChild(li);
          }
          if (!!groupedConversations[group][i].updated) {
            tmp = new Date(groupedConversations[group][i].updated / 1000);
            li = doc.createElement("li");
            li.innerHTML = tmp.nice_date();
            ulUpdated.appendChild(li);
          }
          li = doc.createElement("li");
          li.innerHTML = groupedConversations[group][i].status;
          ulStatus.appendChild(li);
          totalMessages += groupedConversations[group][i].messages;
          totalWords += groupedConversations[group][i].words;
        }
        tdNames.appendChild(ulNames);
        tr.appendChild(tdNames);
        tdStart.appendChild(ulStart);
        tr.appendChild(tdStart);
        tdUpdated.appendChild(ulUpdated);
        tr.appendChild(tdUpdated);
        tdStatus.appendChild(ulStatus);
        tr.appendChild(tdStatus);

        // for type and participants can just use the data in the zero-th spot
        // since it's all duplicate
        td = doc.createElement("td");
        td.innerHTML = groupedConversations[group][0].type;
        tr.appendChild(td);
        tmp = groupedConversations[group][0].people.length + " participants<br>";
        for (j = 0; j < groupedConversations[group][0].people.length; j++) {
          person = lookupPerson(groupedConversations[group][0].people[j]);
          if (!!person) {
            tmp += " <a href=\"https://plus.google.com/" + person.id + "\">";
            tmp += "<img alt=\"" + (person.displayName || "unknown") + "\" ";
            tmp += " title=\"" + (person.displayName || "unknown") + "\" ";
            tmp += " src=\"";
            if (!!person.image) {
              tmp += person.image;
            } else {
              tmp += "../images/noimage.png";
            }
            tmp += "\"></a>";
          }
        }
        td = doc.createElement("td");
        td.innerHTML = tmp;
        td.setAttribute("sorttable_customkey", groupedConversations[group][0].people.length);
        tr.appendChild(td);

        td = doc.createElement("td");
        td.innerHTML = totalMessages;
        tr.appendChild(td);

        td = doc.createElement("td");
        td.innerHTML = totalWords;
        tr.appendChild(td);

        convoDataTable.appendChild(tr);
      }

      global.location.hash = "#data";
      doc.getElementById("data").getElementsByClassName("combine")[0].style.display = "none";
    }

    function initialize() {
      dropZone = doc.getElementById("drop_zone");
      convoDataTable = doc.getElementById("convo_data").getElementsByTagName("tbody")[0];
      progress = doc.getElementById("progress");
      addEvent(dropZone, "dragover", handleDragOver);
      addEvent(dropZone, "drop", handleFileSelect);
      addEvent(dropZone, "dragenter", function () {
        dropZone.className = "dragging";
      });
      addEvent(dropZone, "dragleave", function () {
        dropZone.className = "";
      });
      doc.getElementById("progress").style.display = "none";

      doc.getElementById("stat_overview").onclick = reportOverview;
      doc.getElementById("overview").getElementsByClassName("recalculate")[0].onclick = reportOverview;
      doc.getElementById("stat_data").onclick = reportData;
      doc.getElementById("data").getElementsByClassName("recalculate")[0].onclick = reportData;
      doc.getElementById("data").getElementsByClassName("combine")[0].onclick = combineData;
    }

    initialize();
  }

  global.onClientReady = function () {
    client = global.gapi.client;
    client.setApiKey(apikey);
    client.load("plus", "v1", function () {
      allmyplus = new AllMyPlus();
    });
  };
}(this));