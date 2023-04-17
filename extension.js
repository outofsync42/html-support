const vscode = require('vscode');
const custom = require('./lib/custom.js');
const app = new custom.Application();
const htmlSettings = new custom.ConfigSettings('html');

var HtmlSupport = function () {

	var self = this;

	//HTML Actions
	this.checkAutoQuotes = function (lines, line_x, charText) {

		if (isset(lines[line_x]['line_links'])) {
			for (var i in lines[line_x]['line_links']) {
				self.checkAutoQuotes(lines, lines[line_x]['line_links'][i], charText)
			}
		}

		let position = app.editorCursorPosition();
		let charPos = position.character;

		let elements = lines[line_x]['html']['elements'];

		let quoteType = htmlSettings.getValue('completion.attributeDefaultValue', 'empty');
		let quote = quoteType == 'singlequotes' ? "'" : '"'
		for (var element_id in elements) {
			for (var type in elements[element_id]['attributes']) {
				let attrs = elements[element_id]['attributes'][type];
				for (var i in attrs) {
					//if equal sign pressed
					
					let nextChar = isset(lines[attrs[i].line]['text'][charPos + 1]) ? lines[attrs[i].line]['text'][charPos + 1] : null;
					if (charText == "=" && quoteType !== "empty" && attrs[i].line == position.line && position.character == attrs[i].start && position.character == attrs[i].end) {
						if (nextChar && /[a-zA-Z]/.test(nextChar)) {
							app.editorInsertText(position.line, charPos + 1, quote);
							app.editorSetCursorPosition(position.line, charPos + 1);
						} else {
							//add double quotes after equals
							app.editorInsertText(position.line, charPos + 1, quote + quote);
							app.editorSetCursorPosition(position.line, charPos + 2);
						}
					}

					//auto closing quote should work for both
					if ((charText == '"' || charText == "'") && attrs[i].line == position.line) {
						if (position.character + 1 == attrs[i].start) {
							if (nextChar && /[a-zA-Z]/.test(nextChar)) {
								continue;
							}
							
							if (lines[attrs[i].line]['text'][charPos - 1] == charText) {
								continue;
							}
							let text = lines[attrs[i].line]['text'];
							//possible
							let x = charPos - 1;
							let valid = true;
							while (x > 0) {
								if (text[x] == " ") {
									x--;
									continue;
								}
								if (/[^=]/.test(text[x]) == true) {
									valid = false;
									break
								}
								//if you get here its valid
								break;
							}
							if (valid) {
								//add second quote
								app.editorInsertText(position.line, charPos + 1, charText);
								app.editorSetCursorPosition(position.line, charPos + 1);
							}

						}
					}
				}
			}
		}

	}
	this.checkRemoveQuote = function (lines, line_x) {

		if (isset(lines[line_x]['line_links'])) {
			for (var i in lines[line_x]['line_links']) {
				self.checkAutoQuotes(lines, lines[line_x]['line_links'][i])
			}
		}

		let position = app.editorCursorPosition();
		let charPos = position.character;
		let elements = lines[line_x]['html']['elements'];

		for (var element_id in elements) {
			for (var type in elements[element_id]['attributes']) {
				let attrs = elements[element_id]['attributes'][type];
				for (var i in attrs) {
					//attribute on same line and quote start is next char pos
					let text = lines[attrs[i].line]['text'];
					if (attrs[i].line == position.line && charPos + 1 == attrs[i].start && (text[charPos] == '"' || text[charPos] == "'")) {
						//possible
						let x = charPos - 1;
						let valid = true;
						while (x > 0) {
							if (text[x] == " ") {
								x--;
								continue;
							}
							if (/[^=]/.test(text[x]) == true) {
								valid = false;
								break
							}
							//if you get here its valid
							break;
						}
						if (valid) {
							app.editorDeleteText(attrs[i].line, charPos, charPos + 1);
						}
					}
				}
			}
		}
	}
	this.checkAutoClosingTag = function (lines, line_x, event) {

		line = lines[line_x];

		if (isset(line['line_links'])) {
			line = lines[line['line_links'][0]];
		}

		let position = app.editorCursorPosition();
		let lineNumber = position.line;
		let charPos = position.character;
		let elements = line['html']['elements'];
		for (var elem_id in elements) {
			let element = elements[elem_id];
			if (element['isVoidElement'] == false && element['endLine'] == lineNumber && element['endPos'] == charPos) {
				let nextChar = isset(lines[line_x]['text'][charPos + 1]) ? lines[line_x]['text'][charPos + 1] : null;
				if (nextChar && /[^ ]/.test(nextChar)) {
					continue;
				}
				app.editorInsertText(lineNumber, charPos + 1, '</' + element['tag'] + '>');
				app.editorSetCursorPosition(position.line, charPos + 1);
			}
		}
	}
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	let htmlSupport = new HtmlSupport();

	//INIT
	app.setContext(context);
	app.setValidDocTypes(['php', 'html']);
	app.setDocumentCacheEnabled();

	//EVENTS
	app.on('documentTextChange', async function (event) {
		let fileType = custom.Document.fileType(event.document);
		if (event.diff == 0 && in_array(fileType, ['php', 'html'])) {
			let lines = app.getDocumentLinesInfo();
			if (lines[event.startLine]['syntax'] === 'html') {
				try {
					if (event.text == ">") {
						//only needed in php file
						if (htmlSettings.getValue('autoClosingTags', false) == true) {
							htmlSupport.checkAutoClosingTag(lines, event.startLine, event);
						}
					}
					if (event.text == "=" || event.text == "'" || event.text == '"') {
						if (htmlSettings.getValue('autoCreateQuotes', false) == true) {
							htmlSupport.checkAutoQuotes(lines, event.startLine, event.text);
						}
					}
					if (event.text == "") {
						if (htmlSettings.getValue('autoCreateQuotes', false) == true) {
							htmlSupport.checkRemoveQuote(lines, event.startLine);
						}
					}
				} catch (e) {
					console.log(e);
				}
			}
		}
	});

	//ACTIVATE
	app.activate();
}

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
