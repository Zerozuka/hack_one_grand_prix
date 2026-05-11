const {
  Presentation,
  PresentationFile,
} = await import("@oai/artifact-tool");

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
};

const slides = [
  {
    section: "01 / 小さくなる日本",
    title: "人口だけでなく、\n人とのつながりも\n小さくなっている。",
    note: "日本は人口減少や単身化が進み、人と関わる機会そのものが減っています。つながりの量だけでなく、気持ちを伝える場も小さくなっていることに注目しました。",
    motif: "shrinking",
  },
  {
    section: "02 / 注目したこと",
    title: "日本人は、\n感謝を思っていても\n口に出すのが苦手だ。",
    note: "ありがとうと思っても、わざわざ言うのは照れくさい。知らない人に話しかけるのは心理的に重い。感謝がないのではなく、表現するハードルが高いのだと考えました。",
    motif: "shy",
  },
  {
    section: "03 / 本質的な課題",
    title: "優しさはある。\nでも、出し方がない。",
    note: "静かにしてくれて助かった、席を譲ってくれてありがたかった、店内の雰囲気が心地よかった。そういう気持ちはあるのに、多くの場合、そのまま消えてしまいます。",
    motif: "hidden",
  },
  {
    section: "04 / 提案",
    title: "匿名でもいいから、\n感謝を空間に\n残せるようにする。",
    note: "カフェなどの空間に対して、ワンタップでありがとう、居心地いい、静かで助かった、を残します。誰か個人に直接言わなくても、空間を通じて気持ちが届く体験です。",
    motif: "proposal",
  },
  {
    section: "05 / 目指す世界",
    title: "内気なままでも、\n優しさは伝えられる。",
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
  const shape = addShape(slide, "rect", position, opts.fill ?? "#FFFFFF00");
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
  return bubble;
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
    const sizes = [116, 86, 58, 34];
    sizes.forEach((s, i) => addShape(slide, "ellipse", {
      left: 830 + i * 82,
      top: 168 + i * 54,
      width: s,
      height: s,
    }, i === 0 ? COLORS.green : ["#9CB99E", "#C5D6BF", "#E7D7C5"][i - 1]));
    addText(slide, "つながり", { left: 842, top: 205, width: 98, height: 30 }, {
      fontSize: 18,
      bold: true,
      color: COLORS.paper,
      alignment: "center",
    });
    return;
  }

  if (motif === "shy") {
    addBubble(slide, "ありがとう", 858, 194, 142, "#FFFFFF", COLORS.deepGreen, 23);
    addShape(slide, "ellipse", { left: 806, top: 360, width: 42, height: 42 }, COLORS.softOrange);
    addShape(slide, "ellipse", { left: 1042, top: 350, width: 42, height: 42 }, COLORS.paleGreen);
    addShape(slide, "connector", { left: 840, top: 374, width: 220, height: 1 }, "#FFFFFF00", {
      style: "dashed",
      fill: COLORS.line,
      width: 2,
    });
    return;
  }

  if (motif === "hidden") {
    addShape(slide, "roundRect", { left: 826, top: 160, width: 288, height: 330 }, "#FFFFFFAA", {
      style: "solid",
      fill: COLORS.line,
      width: 1,
    });
    ["静かで助かった", "席を譲ってくれた", "居心地がよかった"].forEach((t, i) => {
      addShape(slide, "roundRect", { left: 856, top: 210 + i * 76, width: 228, height: 44 }, "#F6F0E6", {
        style: "solid",
        fill: "#E9DFD0",
        width: 1,
      });
      addText(slide, t, { left: 876, top: 217 + i * 76, width: 188, height: 30 }, {
        fontSize: 19,
        bold: true,
        color: COLORS.muted,
        alignment: "center",
      });
    });
    addShape(slide, "ellipse", { left: 930, top: 472, width: 80, height: 80 }, COLORS.deepGreen);
    addText(slide, "?", { left: 930, top: 472, width: 80, height: 80 }, {
      fontSize: 44,
      bold: true,
      color: COLORS.paper,
      alignment: "center",
    });
    return;
  }

  if (motif === "proposal") {
    addShape(slide, "roundRect", { left: 812, top: 150, width: 330, height: 420 }, "#FFFFFF", {
      style: "solid",
      fill: "#DDD3C5",
      width: 1.2,
    });
    addText(slide, "Cafe Space", { left: 848, top: 186, width: 258, height: 32 }, {
      fontSize: 22,
      bold: true,
      color: COLORS.deepGreen,
      alignment: "center",
    });
    addBubble(slide, "ありがとう", 862, 252, 112, COLORS.paleGreen, COLORS.deepGreen, 18);
    addBubble(slide, "居心地", 986, 252, 112, "#F8DFC4", COLORS.ink, 19);
    addBubble(slide, "静か", 924, 386, 112, "#EFE9DC", COLORS.ink, 20);
    addText(slide, "匿名 / ワンタップ", { left: 858, top: 512, width: 236, height: 28 }, {
      fontSize: 18,
      bold: true,
      color: COLORS.muted,
      alignment: "center",
    });
    return;
  }

  addBubble(slide, "ありがとう", 836, 168, 132, COLORS.paleGreen, COLORS.deepGreen, 19);
  addBubble(slide, "やさしい", 976, 238, 132, "#F5D3AF", COLORS.ink, 20);
  addBubble(slide, "居心地", 874, 382, 132, "#FFFFFF", COLORS.ink, 20);
  addShape(slide, "ellipse", { left: 962, top: 386, width: 250, height: 250 }, "#DCEADF77");
}

slides.forEach((item, idx) => {
  const slide = presentation.slides.add();
  addCommonFrame(slide, item.section, idx + 1);
  addMotif(slide, item.motif);

  addText(slide, item.title, { left: 104, top: 162, width: 690, height: 330 }, {
    typeface: FONT.title,
    fontSize: 54,
    bold: true,
    color: COLORS.ink,
    verticalAlignment: "middle",
    autoFit: "shrinkText",
  });

  if (item.closing) {
    addShape(slide, "roundRect", { left: 104, top: 548, width: 700, height: 62 }, "#FFFFFFAA", {
      style: "solid",
      fill: "#E4D9CA",
      width: 1,
    });
    addText(slide, item.closing, { left: 130, top: 560, width: 648, height: 38 }, {
      fontSize: 24,
      bold: true,
      color: COLORS.deepGreen,
      alignment: "center",
      autoFit: "shrinkText",
    });
  } else {
    addShape(slide, "roundRect", { left: 104, top: 536, width: 300, height: 46 }, "#FFFFFF99", {
      style: "solid",
      fill: "#E5DCCE",
      width: 1,
    });
    addText(slide, "1 slide / 1 message", { left: 128, top: 546, width: 252, height: 24 }, {
      fontSize: 17,
      bold: true,
      color: COLORS.muted,
      alignment: "center",
    });
  }

  slide.speakerNotes.setText(item.note);
});

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(new URL("小さくなる日本_カフェ感謝アプリ_5枚案.pptx", OUT_DIR));

for (const [i, slide] of presentation.slides.items.entries()) {
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await png.save(new URL(`preview_slide_${String(i + 1).padStart(2, "0")}.png`, OUT_DIR));
}

