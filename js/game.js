/*** globals ***/
	/* triggers */
		const TRIGGERS = {
			submit: "submit",
			click: "click",
			input: "input"
		}

	/* elements */
		const ELEMENTS = {
			"body": document.querySelector("body"),
			"nav-bar-name": document.querySelector("#nav-bar-name"),
			"quit-game-button": document.querySelector("#quit-game-button"),
			"game-actions-inner": document.querySelector("#game-actions-inner"),
			"delete-game-button": document.querySelector("#delete-game-button"),
			"start-game-button": document.querySelector("#start-game-button"),
			"hide-info-button": document.querySelector("#hide-info-button"),
			"qr-code": document.querySelector("#qr-code"),
			"qr-code-container": document.querySelector("#qr-code-container"),
			"game-state-indicator": document.querySelector("#game-state-indicator"),
			"game-mode-select": document.querySelector("#game-mode-select"),
			"game-mode-win-condition": document.querySelector("#game-mode-win-condition"),
			"game-mode-end-condition": document.querySelector("#game-mode-end-condition"),
			"players-list": document.querySelector("#players-list"),
			"players-list-items": Array.from(document.querySelectorAll(".player")),
			"players-ban-buttons": Array.from(document.querySelectorAll(".player-ban")),
			"gameplay": document.querySelector("#gameplay"),
			"gameplay-status": document.querySelector("#gameplay-status"),
			"gameplay-target": document.querySelector("#gameplay-target"),
			"gameplay-center": document.querySelector("#gameplay-center"),
			"gameplay-time-remaining": document.querySelector("#gameplay-time-remaining"),
			"show-info-button": document.querySelector("#show-info-button")
		}

	/* state */
		const STATE = {
			playerId: null,
			captureWaitTimeout: null,
			captureWaitMS: 2000, // ms
			game: {
				id: ELEMENTS["nav-bar-name"]?.querySelector("span").innerText.trim(),
				ownerId:       null,
				mode:          {},
				timeStart:     0,
				timeRemaining: 0,
				timeEnd:       0,
				players:       {}
			}
		}

/*** helpers ***/
	/* showToast */
		const TOAST = {
			beforeFade: 200, // ms
			afterFade: 5000, // ms
			element: null,
			timeout: null
		}

		function showToast(data) {
			try {
				// clear existing countdowns
					if (TOAST.timeout) {
						clearTimeout(TOAST.timeout)
						TOAST.timeout = null
					}

				// append
					if (!TOAST.element) {
						TOAST.element = document.createElement("div")
						TOAST.element.id = "toast"
						TOAST.element.setAttribute("visibility", false)
						TOAST.element.setAttribute("success", false)
						document.body.appendChild(TOAST.element)
					}

				// show
					setTimeout(() => {
						TOAST.element.innerHTML = data.message
						TOAST.element.setAttribute("success", data.success || false)
						TOAST.element.setAttribute("visibility", true)
					}, TOAST.beforeFade)

				// hide
					TOAST.timeout = setTimeout(() => {
						TOAST.element.setAttribute("visibility", false)
					}, TOAST.afterFade)
			} catch (error) {console.log(error)}
		}

	/* displayQRCode */
		function displayQRCode(text, imageContainer) {
			try {
				// clear
					imageContainer.innerHTML = ""

				// get dimensions element
					const x = imageContainer.clientWidth
					const y = imageContainer.clientHeight

				// create image
					new QRCode(imageContainer, {
						text,
						x,
						y,
						correctLevel: QRCode.CorrectLevel.M
					})
			} catch (error) {console.log(error)}
		}

	/* convertTime */
		function convertTime(seconds) {
			try {
				if (isNaN(seconds)) {
					return seconds
				}

				return `${Math.floor(seconds / 60)}:${('00' + Math.floor(seconds % 60)).slice(-2)}`
			} catch (error) {console.log(error)}
		}

/*** socket ***/
	/* start */
		const SOCKET = {
			connection: null,
			createLoop: null,
			createInterval: 5 * 1000, // ms
			pingLoop: null,
			pingInterval: 60 * 1000, // ms
			keepPinging: null
		}

	/* createSocket */
		createSocket()
		SOCKET.createLoop = setInterval(createSocket, SOCKET.createInterval)
		function createSocket() {
			try {
				// already created
					if (SOCKET.connection) {
						clearInterval(SOCKET.createLoop)
						return
					}

				// connect
					SOCKET.connection = new WebSocket(location.href.replace("http","ws"))
					SOCKET.connection.onopen = () => {
						SOCKET.connection.send(null)
					}

				// disconnect
					SOCKET.connection.onerror = error => {
						SOCKET.connection.onclose = () => {}
						clearInterval(SOCKET.createLoop)
						window.location = "/"
					}
					SOCKET.connection.onclose = () => {
						showToast({success: false, message: `disconnected`})
						SOCKET.connection = null
						
						createSocket()
						SOCKET.createLoop = setInterval(createSocket, SOCKET.createInterval)
					}

				// message
					SOCKET.connection.onmessage = message => {
						try {
							SOCKET.keepPinging = true
							const post = JSON.parse(message.data)
							if (post && (typeof post == "object")) {
								receiveSocket(post)
							}
						}
						catch (error) {console.log(error)}
					}

				// ping
					SOCKET.keepPinging = false
					clearInterval(SOCKET.pingLoop)
					SOCKET.pingLoop = setInterval(pingServer, SOCKET.pingInterval)
			} catch (error) {console.log(error)}
		}

	/* pingServer */
		function pingServer() {
			try {
				if (!SOCKET.keepPinging) {
					return
				}

				SOCKET.keepPinging = false
				fetch("/ping", {method: "GET"})
					.then(response => response.json())
					.then(data => {})
			} catch (error) {console.log(error)}
		}

	/* receiveSocket */
		function receiveSocket(data) {
			try {
				// redirect
					if (data.location) {
						window.location = data.location
						return
					}
					
				// failure
					if (!data || !data.success) {
						showToast({success: false, message: data.message || `unknown websocket error`})

						// force close
							if (data.close) {
								SOCKET.connection.onclose = () => {}
								if (SOCKET.connection.readyState == 1) { // OPEN
									SOCKET.connection.close()
								}

								setTimeout(() => {
									window.location = "/"
								}, 2000) // ms
							}
						return
					}

				// toast
					if (data.message) {
						showToast(data)
					}

				// data
					if (data.playerId) {
						STATE.playerId = data.playerId
					}

					if (data.game) {
						displayGame(data.game)
					}
			} catch (error) {console.log(error)}
		}

/*** display ***/
	/* displayGameQRCode */
		displayGameQRCode()
		function displayGameQRCode() {
			try {
				// get gameId
					const gameId = ELEMENTS["qr-code-container"]?.innerHTML
					if (!gameId) {
						return
					}

				// generate code
					displayQRCode(gameId, ELEMENTS["qr-code-container"])
			} catch (error) {console.log(error)}
		}

	/* displayGame */
		function displayGame(data) {
			try {
				// wrong id
					if (data.id !== STATE.game.id) {
						showToast({success: false, message: `game id mismatch`})
						return
					}

				// owner
					if (data.ownerId !== STATE.game.ownerId) {
						STATE.game.ownerId = data.ownerId
						displayOwner()
					}

				// mode
					if (data.mode.id !== STATE.game.mode?.id) {
						STATE.game.mode = data.mode
						ELEMENTS["game-mode-select"].value = STATE.game.mode.id
						ELEMENTS["game-mode-win-condition"].innerHTML = STATE.game.mode.winCondition
						ELEMENTS["game-mode-end-condition"].innerHTML = STATE.game.mode.endCondition
					}

				// time
					// end
						if (data.timeEnd !== STATE.game.timeEnd) {
							STATE.game.timeEnd = data.timeEnd
							ELEMENTS["quit-game-button"]?.remove()
							ELEMENTS["start-game-button"]?.remove()
							ELEMENTS["delete-game-button"]?.remove()
							ELEMENTS["hide-info-button"]?.remove()
							ELEMENTS["qr-code"]?.remove()
							ELEMENTS["players-ban-buttons"]?.forEach(element => element.remove())
							ELEMENTS["game-state-indicator"].innerHTML = `ended ${new Date(STATE.game.timeEnd).toLocaleString()}`
							ELEMENTS["body"].removeAttribute("gameplay")
							stopScanning()
						}

					// start
						if (data.timeStart !== STATE.game.timeStart) {
							STATE.game.timeStart = data.timeStart
							ELEMENTS["game-mode-select"]?.setAttribute("disabled", true)
							ELEMENTS["start-game-button"]?.remove()
							ELEMENTS["delete-game-button"]?.remove()
							ELEMENTS["qr-code"]?.remove()
							ELEMENTS["body"].setAttribute("gameplay", true)
							startScanning()
						}

					// remaining
						if (data.timeRemaining) {
							STATE.game.timeRemaining = data.timeRemaining
							const timeRemainingString = convertTime(STATE.game.timeRemaining)
							ELEMENTS["gameplay-time-remaining"].innerHTML = timeRemainingString
							ELEMENTS["game-state-indicator"].innerHTML = timeRemainingString
						}

				// players
					// upsert data
						for (const playerId in data.players) {
							STATE.game.players[playerId] = data.players[playerId]
						}

					// display
						for (const playerId in STATE.game.players) {
							// remove quitters
								if (!data.players[playerId]) {
									removePlayer(playerId)
								}

							// display
								displayPlayer(STATE.game.players[playerId])
						}
			} catch (error) {console.log(error)}
		}
	
	/* displayOwner */
		function displayOwner() {
			try {
				// not self
					if (STATE.game.ownerId !== STATE.playerId) {
						return
					}

				// message
					showToast({success: true, message: `you are game owner`})

				// start game button
					if (!STATE.game.timeStart && !ELEMENTS["start-game-button"]) {
						ELEMENTS["start-game-button"] = document.createElement("button")
						ELEMENTS["start-game-button"].id = "start-game-button"
						ELEMENTS["start-game-button"].innerHTML = "start game"
						ELEMENTS["start-game-button"].addEventListener(TRIGGERS.click, startGame)
						ELEMENTS["game-actions-inner"].appendChild(ELEMENTS["start-game-button"])
					}

				// delete game button
					if (!STATE.game.timeEnd && !ELEMENTS["delete-game-button"]) {
						ELEMENTS["delete-game-button"] = document.createElement("button")
						ELEMENTS["delete-game-button"].id = "delete-game-button"
						ELEMENTS["delete-game-button"].innerHTML = "cancel game"
						ELEMENTS["delete-game-button"].addEventListener(TRIGGERS.click, deleteGame)
						ELEMENTS["game-actions-inner"].appendChild(ELEMENTS["delete-game-button"])
					}

				// game mode select
					if (!STATE.game.timeStart) {
						ELEMENTS["game-mode-select"].removeAttribute("disabled")
					}

				// players ban buttons
					if (!STATE.game.timeEnd) {
						ELEMENTS["players-ban-buttons"] = []
						ELEMENTS["players-list-items"].forEach(playerElement => displayBanButton(playerElement))
					}
			} catch (error) {console.log(error)}
		}

	/* displayBanButton */
		function displayBanButton(playerElement) {
			try {
				// not self
					const playerId = playerElement.id.split("-")[1]
					if (playerId == STATE.playerId) {
						return
					}

				// ban button
					const banButton = document.createElement("button")
						banButton.className = "player-ban"
						banButton.value = playerId
						banButton.innerHTML = "ban"
						banButton.addEventListener(TRIGGERS.click, banPlayer)
					ELEMENTS["players-ban-buttons"].push(banButton)
					playerElement.querySelector(".player-status").after(banButton)
			} catch (error) {console.log(error)}
		}

	/* displayPlayer */
		function displayPlayer(player) {
			try {
				// no player?
					if (!player) {
						return
					}

				// player info
					const status = STATE.game.timeEnd ? (player.win ? "win" : player.loss ? "loss" : "unknown") :
								   !player.connected ? "disconnected" :
								   STATE.game.timeStart ? (player.cooldown ? `stunned (${player.cooldown})` : (player.target ? "in" : "out")) :
								   "ready"
					const target = player.target ? (STATE.game.players[player.target]?.name || "?") : "-"

				// self?
					if (player.userId == STATE.playerId) {
						ELEMENTS["gameplay-status"].innerHTML = status
						ELEMENTS["gameplay-target"].innerHTML = `&target;<br>${target == "-" ? 
							Object.keys(STATE.game.players).filter(id => id !== player.userId && STATE.game.players[id].target).map(id => STATE.game.players[id].name).join("<br>") || "-" :
							target}`
					}

				// existing playerElement
					const playerElement = ELEMENTS["players-list-items"].find(element => element.id == `player-${player.userId}`)
					if (playerElement) {
						playerElement.querySelector(".player-status").innerHTML = status
						playerElement.querySelector(".player-stat-target").innerHTML = target
						playerElement.querySelector(".player-stat-shots").innerHTML = player.shots
						playerElement.querySelector(".player-stat-stuns").innerHTML = player.stuns
						playerElement.querySelector(".player-stat-time-in").innerHTML = convertTime(player.timeIn)
						playerElement.querySelector(".player-stat-time-out").innerHTML = convertTime(player.timeOut)
						return
					}

				// new playerElement
					buildPlayer(player, status)
			} catch (error) {console.log(error)}
		}

	/* removePlayer */
		function removePlayer(playerId) {
			try {
				// remove from data
					delete STATE.game.players[playerId]

				// remove element
					const playerElement = ELEMENTS["players-list-items"].find(element => element.id == `player-${playerId}`)
						playerElement?.remove()
					ELEMENTS["players-list-items"] = ELEMENTS["players-list-items"].filter(element => element !== playerElement)
			} catch (error) {console.log(error)}
		}

	/* buildPlayer */
		function buildPlayer(player, status) {
			try {
				// new playerElement
					const newPlayerElement = document.createElement("div")
						newPlayerElement.className = "player"
						newPlayerElement.id = `player-${player.userId}`
					ELEMENTS["players-list"].appendChild(newPlayerElement)
					ELEMENTS["players-list-items"].push(newPlayerElement)

				// info
					const playerName = document.createElement("h3")
						playerName.className = "player-name"
						playerName.innerHTML = `&#128100; ${player.name}`
					newPlayerElement.appendChild(playerName)

					const playerStatus = document.createElement("h4")
						playerStatus.className = "player-status"
						playerStatus.innerHTML = status
					newPlayerElement.appendChild(playerStatus)
				
				// target
					const playerTarget = document.createElement("li")
						playerTarget.className = "player-stat"
					newPlayerElement.appendChild(playerTarget)
						const playerTargetLabel = document.createElement("span")
							playerTargetLabel.innerHTML = "target"
						playerTarget.appendChild(playerTargetLabel)
						const playerTargetValue = document.createElement("span")
							playerTargetValue.className = "player-stat-target"
							playerTargetValue.innerHTML = player.target ? (STATE.game.players[player.target]?.name || "?") : "-"
						playerTarget.appendChild(playerTargetValue)

				// shots
					const playerShots = document.createElement("li")
						playerShots.className = "player-stat"
					newPlayerElement.appendChild(playerShots)
						const playerShotsLabel = document.createElement("span")
							playerShotsLabel.innerHTML = "shots"
						playerShots.appendChild(playerShotsLabel)
						const playerShotsValue = document.createElement("span")
							playerShotsValue.className = "player-stat-shots"
							playerShotsValue.innerHTML = player.shots
						playerShots.appendChild(playerShotsValue)
				
				// stuns
					const playerStuns = document.createElement("li")
						playerStuns.className = "player-stat"
					newPlayerElement.appendChild(playerStuns)
						const playerStunsLabel = document.createElement("span")
							playerStunsLabel.innerHTML = "stuns"
						playerStuns.appendChild(playerStunsLabel)
						const playerStunsValue = document.createElement("span")
							playerStunsValue.className = "player-stat-stuns"
							playerStunsValue.innerHTML = player.stuns
						playerStuns.appendChild(playerStunsValue)

				// time in
					const playerTimeIn = document.createElement("li")
						playerTimeIn.className = "player-stat"
					newPlayerElement.appendChild(playerTimeIn)
						const playerTimeInLabel = document.createElement("span")
							playerTimeInLabel.innerHTML = "time in"
						playerTimeIn.appendChild(playerTimeInLabel)
						const playerTimeInValue = document.createElement("span")
							playerTimeInValue.className = "player-stat-time-in"
							playerTimeInValue.innerHTML = convertTime(player.timeIn)
						playerTimeIn.appendChild(playerTimeInValue)

				// time out
					const playerTimeOut = document.createElement("li")
						playerTimeOut.className = "player-stat"
					newPlayerElement.appendChild(playerTimeOut)
						const playerTimeOutLabel = document.createElement("span")
							playerTimeOutLabel.innerHTML = "time out"
						playerTimeOut.appendChild(playerTimeOutLabel)
						const playerTimeOutValue = document.createElement("span")
							playerTimeOutValue.className = "player-stat-time-out"
							playerTimeOutValue.innerHTML = convertTime(player.timeOut)
						playerTimeOut.appendChild(playerTimeOutValue)

				// ban button
					if (!STATE.game.timeEnd && STATE.playerId && STATE.game.ownerId == STATE.playerId && STATE.playerId !== player.userId) {
						displayBanButton(newPlayerElement)
					}
			} catch (error) {console.log(error)}
		}

/*** actions - owner ***/
	/* deleteGame */
		ELEMENTS["delete-game-button"]?.addEventListener(TRIGGERS.click, deleteGame)
		function deleteGame(event) {
			try {
				// confirm
					if (!window.confirm("Are you sure you want to delete this game?")) {
						return
					}

				// data
					const data = {
						action: "deleteGame"
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* startGame */
		ELEMENTS["start-game-button"]?.addEventListener(TRIGGERS.click, startGame)
		function startGame(event) {
			try {
				// data
					const data = {
						action: "startGame"
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* selectMode */
		ELEMENTS["game-mode-select"]?.addEventListener(TRIGGERS.input, selectMode)
		function selectMode(event) {
			try {
				// data
					const data = {
						action: "selectMode",
						mode: ELEMENTS["game-mode-select"].value
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* banPlayer */
		ELEMENTS["players-ban-buttons"]?.forEach(button => button.addEventListener(TRIGGERS.click, banPlayer))
		function banPlayer(event) {
			try {
				// id
					const id = event.target.value
					const name = STATE.game.players[id]?.name

				// not here
					if (!name) {
						showToast({success: false, message: "player not found"})
					}

				// confirm
					if (!window.confirm(`Are you sure you want to ban ${name}?`)) {
						return
					}

				// data
					const data = {
						action: "banPlayer",
						playerId: event.target.value
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

/*** actions - all ***/
	/* quitGame */
		ELEMENTS["quit-game-button"]?.addEventListener(TRIGGERS.click, quitGame)
		function quitGame(event) {
			try {
				// confirm
					if (!window.confirm("Are you sure you want to leave?")) {
						return
					}

				// data
					const data = {
						action: "quitGame"
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* capturePlayer */
		function capturePlayer(text) {
			try {
				// name --> id
					const name = text.trim()
					const playerId = Object.keys(STATE.game.players).find(playerId => STATE.game.players[playerId].name == name)
					if (!playerId) {
						showToast({success: false, message: `unknown player`})
						return
					}

				// data
					const data = {
						action: "capturePlayer",
						playerId: playerId
					}

				// send
					SOCKET.connection?.send(JSON.stringify(data))
			} catch (error) {console.log(error)}
		}

	/* hideInfo */
		ELEMENTS["hide-info-button"]?.addEventListener(TRIGGERS.click, hideInfo)
		function hideInfo(event) {
			try {
				// activate
					ELEMENTS["body"].setAttribute("gameplay", true)
			} catch (error) {console.log(error)}
		}

	/* showInfo */
		ELEMENTS["show-info-button"]?.addEventListener(TRIGGERS.click, showInfo)
		function showInfo(event) {
			try {
				// inactivate
					ELEMENTS["body"].removeAttribute("gameplay")
			} catch (error) {console.log(error)}
		}

/*** qr code reader ***/
	/* startScanning */
		function startScanning(event) {
			try {
				// not a player
					if (!STATE.playerId) {
						return
					}

				// already ended
					if (STATE.game.timeEnd) {
						return
					}

				// first time
					if (!ELEMENTS["qr-code-reader"]) {
						// create element
							const readerElement = document.createElement("div")
								readerElement.id = "qr-code-reader-area"
							ELEMENTS["qr-code-reader-area"] = readerElement
							ELEMENTS["gameplay-center"].appendChild(readerElement)

						// create reader
							ELEMENTS["qr-code-reader"] = new Html5Qrcode(readerElement.id)
					}

				// initialize
					startQRcodeDetector()
			} catch (error) {console.log(error)}
		}

	/* startQRcodeDetector */
		function startQRcodeDetector() {
			try {
				// clear timeout
					clearTimeout(STATE.captureWaitTimeout)
					STATE.captureWaitTimeout = null

				// scanning --> return
					if (ELEMENTS["qr-code-reader"].getState() == 2) { // SCANNING
						return
					}

				// paused --> resume
					if (ELEMENTS["qr-code-reader"].getState() == 3) { // PAUSED
						ELEMENTS["qr-code-reader"].resume()
						return
					}

				// not started / unknown --> start
					ELEMENTS["qr-code-reader"].start({facingMode: "environment"}, {fps: 10}, detectQRcode)
											  .then(handleQRcodeElements)
											  .catch(detectQRcode)
			} catch (error) {console.log(error)}
		}

	/* handleQRcodeElements */
		function handleQRcodeElements() {
			try {
				// tasks
					const tasks = {
						removePausedIndicator: true,
						attachVideoElement: true
					}

				// loop
					const taskInterval = setInterval(() => {
						// paused indicator
							if (tasks.removePausedIndicator && ELEMENTS["qr-code-reader"].scannerPausedUiElement) {
								ELEMENTS["qr-code-reader"].scannerPausedUiElement.remove()
								delete tasks.removePausedIndicator
							}

						// video element
							if (tasks.attachVideoElement && ELEMENTS["qr-code-reader"].element.querySelector("video")) {
								ELEMENTS["qr-code-reader"].videoElement = ELEMENTS["qr-code-reader"].element.querySelector("video")
								delete tasks.attachVideoElement
							}

						// no more tasks
							if (!Object.keys(tasks).length) {
								clearInterval(taskInterval)
							}
					}, 100) // ms
			} catch (error) {console.log(error)}
		}

	/* detectQRcode */
		function detectQRcode(text, result) {
			try {
				// no text?
					if (!text || !text.length) {
						return
					}

				// stop scanning
					if (ELEMENTS["qr-code-reader"].getState() == 2) { // SCANNING
						ELEMENTS["qr-code-reader"].pause()
						STATE.captureWaitTimeout = setTimeout(startQRcodeDetector, STATE.captureWaitMS)
					}

				// capture
					capturePlayer(text)
			} catch (error) {console.log(error)}
		}

	/* stopScanning */
		function stopScanning() {
			try {
				// no reader
					if (!ELEMENTS["qr-code-reader"]) {
						return
					}

				// qr code scanner
					clearTimeout(STATE.captureWaitTimeout)
					STATE.captureWaitTimeout = null

					ELEMENTS["qr-code-reader-area"]?.remove()
					delete ELEMENTS["qr-code-reader-area"]

					if (ELEMENTS["qr-code-reader"].getState() == 2) { // SCANNING
						ELEMENTS["qr-code-reader"].pause()
					}
					delete ELEMENTS["qr-code-reader"]
			} catch (error) {console.log(error)}
		}
