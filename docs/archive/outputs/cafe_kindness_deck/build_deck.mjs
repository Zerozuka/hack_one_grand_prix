const {
  Presentation,
  PresentationFile,
} = await import("@oai/artifact-tool");
const fs = await import("node:fs/promises");

const OUT_DIR = new URL("./", import.meta.url);
const W = 1280;
const H = 720;

const FONT = {
  title: "Hiragino Sans",
  body: "Hiragino Sans",
};

const COLORS = {
  ink: "#1F2522",
  muted: "#667069",
  warm: "#F7F2E8",
  paper: "#FFFDF7",
  green: "#7EA58A",
  deepGreen: "#315745",
  orange: "#D9824B",
  softOrange: "#F2C79E",
  line: "#D8D0C2",
  paleGreen: "#DCEADF",
  skin: "#F2C8A8",
  skinDeep: "#E4B08E",
  brown: "#6C5647",
  grayBlue: "#9EABB6",
};

const slides = [
  {
    section: "01 / 小さくなる日本",
    title: "人口だけでなく、\n人とのつながりも\n小さくなっている。",
    support: [
      "人口減少と単身化が進んでいる",
      "人と関わる機会も、気持ちを伝える場も減っている",
      "数字だけでなく、つながりの質も縮んでいる",
    ],
    note: "日本は人口減少や単身化が進み、人と関わる機会そのものが減っています。つながりの量だけでなく、気持ちを伝える場も小さくなっていることに注目しました。",
    motif: "shrinking",
  },
  {
    section: "02 / 注目したこと",
    title: "日本人は、\n感謝を思っていても\n口に出すのが苦手だ。",
    support: [
      "ありがとうと思っても、わざわざ言うのは照れくさい",
      "知らない人に話しかけるのは心理的に重い",
      "感謝がないのではなく、表現コストが高い",
    ],
    note: "ありがとうと思っても、わざわざ言うのは照れくさい。知らない人に話しかけるのは心理的に重い。感謝がないのではなく、表現するハードルが高いのだと考えました。",
    motif: "shy",
  },
  {
    section: "03 / 本質的な課題",
    title: "優しさはある。\nでも、出し方がない。",
    support: [
      "静かにしてくれて助かった",
      "席を譲ってくれてありがたかった",
      "でもその気持ちは、言葉にならず消えていく",
    ],
    note: "静かにしてくれて助かった、席を譲ってくれてありがたかった、店内の雰囲気が心地よかった。そういう気持ちはあるのに、多くの場合、そのまま消えてしまいます。",
    motif: "hidden",
  },
  {
    section: "04 / 提案",
    title: "匿名でもいいから、\n感謝を空間に\n残せるようにする。",
    support: [
      "個人ではなく、空間にワンタップで反応する",
      "匿名だから、内気な人でも気持ちを出しやすい",
      "感謝が場所に残り、次の人にも伝わる",
    ],
    note: "カフェなどの空間に対して、ワンタップでありがとう、居心地いい、静かで助かった、を残します。誰か個人に直接言わなくても、空間を通じて気持ちが届く体験です。",
    motif: "proposal",
  },
  {
    section: "05 / 目指す世界",
    title: "内気なままでも、\n優しさは伝えられる。",
    support: [
      "性格を無理に変えなくていい",
      "話しかけなくても、優しさは見える",
      "空間を介して、場が少しあたたかくなる",
    ],
    note: "性格を無理に変えなくていい。話しかけなくてもいい。でも感謝や好意が見えることで、空間は少しあたたかくなります。人は冷たいのではない。優しさを出す方法がないだけだ、というメッセージで締めます。",
    motif: "future",
    closing: "人は冷たいのではない。優しさを出す方法がないだけだ。",
  },
];

const presentation = Presentation.create({
  slideSize: { width: W, height: H },
});

presentation.theme.colorScheme = {
  name: "Cafe Kindness",
  themeColors: {
    accent1: COLORS.green,
    accent2: COLORS.orange,
    accent3: COLORS.softOrange,
    accent4: COLORS.deepGreen,
    bg1: COLORS.warm,
    bg2: COLORS.paper,
    tx1: COLORS.ink,
    tx2: COLORS.muted,
  },
};

function addShape(slide, geometry, position, fill, line = { style: "solid", fill: "#FFFFFF00", width: 0 }) {
  return slide.shapes.add({ geometry, position, fill, line });
}

function addText(slide, text, position, opts = {}) {
  const shape = addShape(slide, "rect", position, opts.fill ?? "#FFFFFF00", opts.line);
  shape.text = text;
  shape.text.typeface = opts.typeface ?? FONT.body;
  shape.text.fontSize = opts.fontSize ?? 28;
  shape.text.bold = opts.bold ?? false;
  shape.text.color = opts.color ?? COLORS.ink;
  shape.text.alignment = opts.alignment ?? "left";
  shape.text.verticalAlignment = opts.verticalAlignment ?? "middle";
  shape.text.insets = opts.insets ?? { left: 0, right: 0, top: 0, bottom: 0 };
  if (opts.autoFit) shape.text.autoFit = opts.autoFit;
  return shape;
}

function addBubble(slide, text, x, y, size, fill, color = COLORS.ink, fontSize = 24) {
  const bubble = addShape(slide, "ellipse", { left: x, top: y, width: size, height: size }, fill, {
    style: "solid",
    fill: "#FFFFFF88",
    width: 1.2,
  });
  bubble.text = text;
  bubble.text.typeface = FONT.body;
  bubble.text.fontSize = fontSize;
  bubble.text.bold = true;
  bubble.text.color = color;
  bubble.text.alignment = "center";
  bubble.text.verticalAlignment = "middle";
  bubble.text.insets = { left: 6, right: 6, top: 6, bottom: 6 };
  if (bubble.text.autoFit !== undefined) {
    bubble.text.autoFit = "shrinkText";
  }
  return bubble;
}

function addChip(slide, text, position, fill = "#FFFFFFB8", color = COLORS.deepGreen) {
  addShape(slide, "roundRect", position, fill, {
    style: "solid",
    fill: "#E1D7C8",
    width: 1,
  });
  addText(slide, text, {
    left: position.left + 18,
    top: position.top + 6,
    width: position.width - 36,
    height: position.height - 12,
  }, {
    fontSize: 18,
    bold: true,
    color,
    alignment: "center",
    autoFit: "shrinkText",
  });
}

function addSupportCard(slide, lines, top = 438, width = 590) {
  addShape(slide, "roundRect", { left: 104, top, width, height: 116 }, "#FFFFFFB8", {
    style: "solid",
    fill: "#E1D7C8",
    width: 1,
  });
  addShape(slide, "rect", { left: 126, top: top + 18, width: 4, height: 76 }, COLORS.green);
  lines.forEach((line, index) => {
    addText(slide, `・ ${line}`, {
      left: 146,
      top: top + 14 + index * 28,
      width: width - 60,
      height: 26,
    }, {
      fontSize: 18,
      color: COLORS.muted,
      bold: index === 0,
      autoFit: "shrinkText",
    });
  });
}

function addCafeTable(slide, x, y, width = 210, height = 22) {
  addShape(slide, "ellipse", { left: x, top: y, width, height }, "#E9DECF", {
    style: "solid",
    fill: "#D7C9B5",
    width: 1,
  });
  addShape(slide, "rect", { left: x + width / 2 - 7, top: y + height - 4, width: 14, height: 54 }, "#D1C0A9");
  addShape(slide, "ellipse", { left: x + width / 2 - 26, top: y + 60, width: 52, height: 12 }, "#DED3C2");
}

function addCup(slide, x, y, scale = 1) {
  addShape(slide, "roundRect", { left: x, top: y, width: 20 * scale, height: 14 * scale }, "#F9F8F4", {
    style: "solid",
    fill: "#D9CFBE",
    width: 1,
  });
  addShape(slide, "ellipse", { left: x + 15 * scale, top: y + 2 * scale, width: 8 * scale, height: 8 * scale }, "#FFFFFF00", {
    style: "solid",
    fill: "#D9CFBE",
    width: 1,
  });
}

function addBustPerson(slide, x, y, scale = 1, shirt = COLORS.paleGreen, hair = COLORS.brown, accent = COLORS.grayBlue) {
  addShape(slide, "ellipse", { left: x + 18 * scale, top: y, width: 38 * scale, height: 42 * scale }, COLORS.skin);
  addShape(slide, "ellipse", { left: x + 14 * scale, top: y - 8 * scale, width: 46 * scale, height: 24 * scale }, hair);
  addShape(slide, "rect", { left: x + 31 * scale, top: y + 38 * scale, width: 12 * scale, height: 12 * scale }, COLORS.skinDeep);
  addShape(slide, "roundRect", { left: x, top: y + 46 * scale, width: 74 * scale, height: 86 * scale }, shirt, {
    style: "solid",
    fill: accent,
    width: 1,
  });
  addShape(slide, "roundRect", { left: x - 8 * scale, top: y + 58 * scale, width: 18 * scale, height: 54 * scale }, COLORS.skin);
  addShape(slide, "roundRect", { left: x + 64 * scale, top: y + 58 * scale, width: 18 * scale, height: 54 * scale }, COLORS.skin);
}

function addDotPath(slide, dots) {
  dots.forEach((dot) => {
    addShape(slide, "ellipse", {
      left: dot.x,
      top: dot.y,
      width: dot.size,
      height: dot.size,
    }, dot.fill);
  });
}

function addCommonFrame(slide, section, index) {
  slide.background.fill = COLORS.warm;

  addShape(slide, "rect", { left: 0, top: 0, width: W, height: H }, COLORS.warm);
  addShape(slide, "ellipse", { left: -230, top: -180, width: 540, height: 540 }, "#FFF9EC");
  addShape(slide, "ellipse", { left: 928, top: 420, width: 500, height: 500 }, "#E8F0E4");
  addShape(slide, "rect", { left: 76, top: 68, width: 4, height: 584 }, COLORS.green);

  addText(slide, section, { left: 104, top: 58, width: 500, height: 30 }, {
    fontSize: 20,
    bold: true,
    color: COLORS.deepGreen,
  });

  addText(slide, String(index).padStart(2, "0"), { left: 1088, top: 56, width: 90, height: 40 }, {
    fontSize: 26,
    bold: true,
    color: "#A8A198",
    alignment: "right",
  });
}

function addMotif(slide, motif) {
  if (motif === "shrinking") {
    addBustPerson(slide, 802, 214, 1.0, "#E0ECE1", COLORS.brown, "#C7D9CB");
    addBustPerson(slide, 936, 244, 0.82, "#F4DAC0", COLORS.ink, "#EBC9A8");
    addBustPerson(slide, 1052, 274, 0.64, "#E9E5DB", COLORS.brown, "#D8D2C6");
    addDotPath(slide, [
      { x: 878, y: 300, size: 18, fill: "#AFC8B3" },
      { x: 920, y: 318, size: 13, fill: "#C8D8C9" },
      { x: 980, y: 338, size: 10, fill: "#DFE7DE" },
      { x: 1034, y: 354, size: 8, fill: "#EEDCC9" },
    ]);
    addChip(slide, "つながりの縮小", { left: 858, top: 166, width: 180, height: 42 }, "#FFFFFFC8");
    return;
  }

  if (motif === "shy") {
    addCafeTable(slide, 845, 418, 220, 20);
    addCup(slide, 895, 410, 1);
    addCup(slide, 1008, 410, 1);
    addBustPerson(slide, 840, 250, 0.95, "#DDE9DE", COLORS.brown, "#C7D7C9");
    addBustPerson(slide, 998, 250, 0.95, "#F4D7BC", COLORS.ink, "#E8C39C");
    addBubble(slide, "ありがとう", 864, 154, 130, "#FFFFFF", COLORS.deepGreen, 21);
    addDotPath(slide, [
      { x: 960, y: 214, size: 10, fill: "#D7D0C5" },
      { x: 986, y: 226, size: 8, fill: "#E3DDD2" },
      { x: 1008, y: 238, size: 6, fill: "#ECE7DF" },
    ]);
    return;
  }

  if (motif === "hidden") {
    addBustPerson(slide, 786, 324, 0.92, "#E8EFE9", COLORS.brown, "#CBDCCF");
    addChip(slide, "静かで助かった", { left: 884, top: 184, width: 214, height: 44 }, "#FFF8EF");
    addChip(slide, "席を譲ってくれた", { left: 854, top: 248, width: 244, height: 44 }, "#FFF8EF");
    addChip(slide, "居心地がよかった", { left: 884, top: 312, width: 214, height: 44 }, "#FFF8EF");
    addShape(slide, "ellipse", { left: 930, top: 412, width: 92, height: 92 }, COLORS.deepGreen);
    addText(slide, "?", { left: 930, top: 414, width: 92, height: 86 }, {
      fontSize: 48,
      bold: true,
      color: COLORS.paper,
      alignment: "center",
    });
    return;
  }

  if (motif === "proposal") {
    addBustPerson(slide, 792, 268, 0.95, "#E8EFE9", COLORS.brown, "#CBDCCF");
    addShape(slide, "roundRect", { left: 852, top: 404, width: 34, height: 58 }, COLORS.ink, {
      style: "solid",
      fill: "#4A504D",
      width: 1,
    });
    addDotPath(slide, [
      { x: 908, y: 402, size: 14, fill: "#B8CCBA" },
      { x: 934, y: 388, size: 18, fill: "#C8D8C9" },
      { x: 968, y: 368, size: 22, fill: "#E2ECE3" },
    ]);
    addShape(slide, "roundRect", { left: 960, top: 158, width: 224, height: 336 }, "#FFFFFFD8", {
      style: "solid",
      fill: "#D9CFBE",
      width: 1,
    });
    addText(slide, "Cafe Space", { left: 990, top: 188, width: 164, height: 30 }, {
      fontSize: 24,
      bold: true,
      color: COLORS.deepGreen,
      alignment: "center",
    });
    addBubble(slide, "ありがとう", 984, 234, 82, COLORS.paleGreen, COLORS.deepGreen, 14);
    addBubble(slide, "居心地", 1080, 234, 82, "#F8DFC4", COLORS.ink, 16);
    addBubble(slide, "静か", 1032, 336, 82, "#EFE9DC", COLORS.ink, 18);
    addText(slide, "匿名 / ワンタップ", { left: 990, top: 438, width: 164, height: 26 }, {
      fontSize: 17,
      bold: true,
      color: COLORS.muted,
      alignment: "center",
    });
    return;
  }

  addCafeTable(slide, 838, 438, 252, 22);
  addCup(slide, 910, 430, 1);
  addCup(slide, 1032, 430, 1);
  addBustPerson(slide, 818, 272, 0.9, "#E0ECE1", COLORS.brown, "#C6D7C8");
  addBustPerson(slide, 932, 238, 0.98, "#F5D7BB", COLORS.ink, "#E8C39C");
  addBustPerson(slide, 1050, 288, 0.84, "#E9E5DB", COLORS.brown, "#D3CEC3");
  addBubble(slide, "ありがとう", 850, 154, 106, COLORS.paleGreen, COLORS.deepGreen, 18);
  addBubble(slide, "やさしい", 980, 182, 106, "#F5D3AF", COLORS.ink, 19);
  addBubble(slide, "居心地", 904, 344, 106, "#FFFFFF", COLORS.ink, 19);
  addShape(slide, "ellipse", { left: 960, top: 376, width: 250, height: 250 }, "#DCEADF77");
}

slides.forEach((item, idx) => {
  const slide = presentation.slides.add();
  addCommonFrame(slide, item.section, idx + 1);
  addMotif(slide, item.motif);

  addText(slide, item.title, { left: 104, top: 150, width: 650, height: 250 }, {
    typeface: FONT.title,
    fontSize: 52,
    bold: true,
    color: COLORS.ink,
    verticalAlignment: "middle",
    autoFit: "shrinkText",
  });

  addSupportCard(slide, item.support, item.closing ? 418 : 438, item.closing ? 620 : 590);

  if (item.closing) {
    addShape(slide, "roundRect", { left: 104, top: 560, width: 700, height: 58 }, "#FFFFFFAA", {
      style: "solid",
      fill: "#E4D9CA",
      width: 1,
    });
    addText(slide, item.closing, { left: 130, top: 571, width: 648, height: 36 }, {
      fontSize: 24,
      bold: true,
      color: COLORS.deepGreen,
      alignment: "center",
      autoFit: "shrinkText",
    });
  }

  slide.speakerNotes.setText(item.note);
});

const jpPath = new URL("小さくなる日本_カフェ感謝アプリ_5枚案.pptx", OUT_DIR);
const enPath = new URL("cafe_kindness_5slides.pptx", OUT_DIR);

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(jpPath);
await fs.copyFile(jpPath, enPath);

for (const [i, slide] of presentation.slides.items.entries()) {
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  const bytes = Buffer.from(await png.arrayBuffer());
  await fs.writeFile(new URL(`preview_slide_${String(i + 1).padStart(2, "0")}.png`, OUT_DIR), bytes);
}
