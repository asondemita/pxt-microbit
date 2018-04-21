/// <reference path="../node_modules/pxt-core/localtypings/blockly.d.ts" />
/// <reference path="../node_modules/pxt-core/built/pxtsim.d.ts"/>

const rowRegex = /^.*[\.#].*$/;

enum LabelMode {
  None,
  Number,
  Letter
}

export class FieldMatrix extends Blockly.Field implements Blockly.FieldCustom {
  private static CELL_WIDTH = 23;
  private static CELL_HORIZONTAL_MARGIN = 7;
  private static CELL_VERTICAL_MARGIN = 5;
  private static CELL_CORNER_RADIUS = 5;
  private static BOTTOM_MARGIN = 9;
  private static Y_AXIS_WIDTH = 9;
  private static X_AXIS_HEIGHT = 10;
  private static TAB = "        ";

  public isFieldCustom_ = true;

  private params: any;
  private onColor = "#e2484a";
  private offColor = "white";

  // The number of columns
  private matrixWidth: number = 5;

  // The number of rows
  private matrixHeight: number = 5;

  private yAxisLabel: LabelMode = LabelMode.None;
  private xAxisLabel: LabelMode = LabelMode.None;

  private cellState: boolean[][] = [];
  private elt: SVGSVGElement;

  constructor(text: string, params: any, validator?: Function) {
    super(text, validator);
    this.params = params;

    if (this.params.rows !== undefined) {
      let val = parseInt(this.params.rows);
      if (!isNaN(val)) {
        this.matrixHeight = val;
      }
    }

    if (this.params.columns !== undefined) {
      let val = parseInt(this.params.columns);
      if (!isNaN(val)) {
        this.matrixWidth = val;
      }
    }
  }

  /**
   * Show the inline free-text editor on top of the text.
   * @private
   */
  showEditor_() {
    // Intentionally left empty
  }

  private initMatrix() {
    this.elt = pxsim.svg.parseString(`<svg xmlns="http://www.w3.org/2000/svg" id="field-matrix" />`);

    // Initialize the matrix that holds the state
    for (let i = 0; i < this.matrixHeight; i++) {
      this.cellState.push([])
      for (let j = 0; j < this.matrixWidth; j++) {
        this.cellState[i].push(false);
      }
    }

    this.restoreStateFromString();
    this.updateValue()

    // Create the cells of the matrix that is displayed
    for (let i = 0; i < this.matrixWidth; i++) {
      for (let j = 0; j < this.matrixHeight; j++) {
        this.createCell(i, j);
      }
    }

    if (this.xAxisLabel !== LabelMode.None) {
      const y = this.matrixHeight * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_VERTICAL_MARGIN) + FieldMatrix.CELL_VERTICAL_MARGIN * 2 + FieldMatrix.BOTTOM_MARGIN
      const xAxis = pxsim.svg.child(this.elt, "g", { transform: `translate(${0} ${y})` });
      for (let i = 0; i < this.matrixWidth; i++) {
        const x = this.getYAxisWidth() + i * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_HORIZONTAL_MARGIN) + FieldMatrix.CELL_WIDTH / 2 + FieldMatrix.CELL_HORIZONTAL_MARGIN / 2;
        const lbl = pxsim.svg.child(xAxis, "text", { x, class: "blocklyText" })
        lbl.textContent = this.getLabel(i, this.xAxisLabel);
      }
    }

    if (this.yAxisLabel !== LabelMode.None) {
      const yAxis = pxsim.svg.child(this.elt, "g", {});
      for (let i = 0; i < this.matrixHeight; i++) {
        const y = i * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_VERTICAL_MARGIN) + FieldMatrix.CELL_WIDTH / 2 + FieldMatrix.CELL_VERTICAL_MARGIN * 2;
        const lbl = pxsim.svg.child(yAxis, "text", { x: 0, y, class: "blocklyText" })
        lbl.textContent = this.getLabel(i, this.yAxisLabel);
      }
    }

    this.fieldGroup_.appendChild(this.elt);
  }

  private getLabel(index: number, mode: LabelMode) {
    switch (mode) {
      case LabelMode.Letter:
        return String.fromCharCode(index + /*char code for A*/ 65);
      default:
        return (index + 1).toString();
    }
  }

  private createCell(x: number, y: number) {
    const tx = x * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_HORIZONTAL_MARGIN) + FieldMatrix.CELL_HORIZONTAL_MARGIN + this.getYAxisWidth();
    const ty = y * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_VERTICAL_MARGIN) + FieldMatrix.CELL_VERTICAL_MARGIN;

    const cellG = pxsim.svg.child(this.elt, "g", { transform: `translate(${tx} ${ty})` }) as SVGGElement;
    const cellRect = pxsim.svg.child(cellG, "rect", { width: FieldMatrix.CELL_WIDTH, height: FieldMatrix.CELL_WIDTH, fill: this.getColor(x, y), rx: FieldMatrix.CELL_CORNER_RADIUS }) as SVGRectElement;

    pxsim.svg.onClick(cellRect, () => {
      this.cellState[x][y] = !this.cellState[x][y];
      cellRect.setAttribute("fill", this.getColor(x, y));
      this.updateValue()
    });
  }

  private getColor(x: number, y: number) {
    return this.cellState[x][y] ? this.onColor : this.offColor;
  }

  render_() {
    if (!this.visible_) {
      this.size_.width = 0;
      return;
    }

    if (!this.elt) {
      this.initMatrix();
    }


    // The height and width must be set by the render function
    this.size_.height = Number(this.matrixHeight) * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_VERTICAL_MARGIN) + FieldMatrix.CELL_VERTICAL_MARGIN * 2 + FieldMatrix.BOTTOM_MARGIN + this.getXAxisHeight()
    this.size_.width = Number(this.matrixWidth) * (FieldMatrix.CELL_WIDTH + FieldMatrix.CELL_HORIZONTAL_MARGIN) + this.getYAxisWidth();
  }

  // The return value of this function is inserted in the code
  getValue() {
    // getText() returns the value that is set by calls to setValue()
    let text = removeQuotes(this.getText());
    return `\`\n${FieldMatrix.TAB}${text}\n${FieldMatrix.TAB}\``;
  }

  // Restores the block state from the text value of the field
  private restoreStateFromString() {
    let r = this.getText();
    if (r) {
      const rows = r.split("\n").filter(r => rowRegex.test(r));

      for (let y = 0; y < rows.length && y < this.matrixHeight; y++) {
        let x = 0;
        const row = rows[y];

        for (let j = 0; j < row.length && x < this.matrixWidth; j++) {
          if (isNegativeCharacter(row[j])) {
            this.cellState[x][y] = false;
            x++;
          }
          else if (isPositiveCharacter(row[j])) {
            this.cellState[x][y] = true;
            x++;
          }
        }
      }
    }
  }

  // Composes the state into a string an updates the field's state
  private updateValue() {
    let res = "";
    for (let y = 0; y < this.matrixHeight; y++) {
      for (let x = 0; x < this.matrixWidth; x++) {
        res += (this.cellState[x][y] ? "#" : ".") + " "
      }
      res += "\n" + FieldMatrix.TAB
    }

    // Blockly stores the state of the field as a string
    this.setValue(res);
  }

  private getYAxisWidth() {
    return this.yAxisLabel === LabelMode.None ? 0 : FieldMatrix.Y_AXIS_WIDTH;
  }

  private getXAxisHeight() {
    return this.xAxisLabel === LabelMode.None ? 0 : FieldMatrix.X_AXIS_HEIGHT;
  }
}

function isPositiveCharacter(c: string) {
  return c === "#" || c === "*" || c === "1";
}

function isNegativeCharacter(c: string) {
  return c === "." || c === "_" || c === "0";
}


const allQuotes = ["'", '"', "`"];

function removeQuotes(str: string) {
  str = str.trim();
  const start = str.charAt(0);
  if (start === str.charAt(str.length - 1) && allQuotes.indexOf(start) !== -1) {
    return str.substr(1, str.length - 2).trim();
  }
  return str;
}