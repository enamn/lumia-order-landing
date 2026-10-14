import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

// The line icons of the design, on a 20 x 20 grid. They take the colour of the surrounding text unless [color] is given.
const _p = {
  'scan': 'M3 7V4.5A1.5 1.5 0 0 1 4.5 3H7M13 3h2.5A1.5 1.5 0 0 1 17 4.5V7M17 13v2.5a1.5 1.5 0 0 1-1.5 1.5H13M7 17H4.5A1.5 1.5 0 0 1 3 15.5V13M6 10h8',
  'alert': 'M10 6v4.5M10 13.5v.3',
  'bell': 'M10 3a5 5 0 0 0-5 5v3l-1.5 2.5h13L15 11V8a5 5 0 0 0-5-5zM8 16a2 2 0 0 0 4 0',
  'check': 'M5 10.5l3.2 3.2L15 7',
  'clock': 'M10 6.5V10l2.5 1.5',
  'sliders': 'M3 6h8.5M15.5 6H17M3 14h1.5M8.5 14H17',
  'back': 'M12.5 4.5 7 10l5.5 5.5',
  'forward': 'M7.5 4.5 13 10l-5.5 5.5',
  'print': 'M6 7.5V3.5h8v4M6 14.5H4.5A1.5 1.5 0 0 1 3 13V9a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 17 9v4a1.5 1.5 0 0 1-1.5 1.5H14M6 11.5h8v5H6z',
  'minus': 'M5 10h10',
  'plus': 'M5 10h10M10 5v10',
  'bag': 'M4 7.5h12l-1 9H5l-1-9zM7 7.5V6a3 3 0 0 1 6 0v1.5',
};
const _circles = {'alert': '<circle cx="10" cy="10" r="7.5"/>', 'clock': '<circle cx="10" cy="10" r="7"/>', 'sliders': '<circle cx="13.5" cy="6" r="2"/><circle cx="6.5" cy="14" r="2"/>'};

class Ic extends StatelessWidget {
  const Ic(this.name, {super.key, this.size = 24, this.color, this.stroke = 1.7, this.flipInRtl = false});
  final String name;
  final double size, stroke;
  final Color? color;
  final bool flipInRtl; // arrows point the other way in right-to-left
  @override
  Widget build(BuildContext context) {
    final c = color ?? DefaultTextStyle.of(context).style.color ?? Colors.black;
    final svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="$stroke" stroke-linecap="round" stroke-linejoin="round">${_circles[name] ?? ''}<path d="${_p[name]}"/></svg>';
    final w = SvgPicture.string(svg, width: size, height: size, theme: SvgTheme(currentColor: c));
    return flipInRtl && Directionality.of(context) == TextDirection.rtl ? Transform.flip(flipX: true, child: w) : w;
  }
}

// The Lumia mark: a speech bubble outlined in the brand gradient, with a black "L" and a gradient ring "o". Never mirrored in Arabic.
const markSvg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><defs><linearGradient id="g" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FF5577"/><stop offset="1" stop-color="#C93DFF"/></linearGradient></defs><path d="M32 10H68a22 22 0 0 1 22 22v36a22 22 0 0 1-22 22H36L17 95l4-13a22 22 0 0 1-11-14V32a22 22 0 0 1 22-22z" stroke="url(#g)" stroke-width="8" stroke-linejoin="round"/><path d="M28 30V66H40" stroke="#1A0815" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><circle cx="64" cy="55" r="11" stroke="url(#g)" stroke-width="10"/></svg>''';

class LumiaMark extends StatelessWidget {
  const LumiaMark({super.key, this.size = 64});
  final double size;
  @override
  Widget build(BuildContext context) => SvgPicture.string(markSvg, width: size, height: size);
}
