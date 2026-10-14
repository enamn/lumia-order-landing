import 'package:flutter/material.dart';

// Lumia Order brand tokens (from the design "Lumia Order Terminal App", same as the landing page and dashboard).
const ink = Color(0xFF1A0815), ink2 = Color(0xFF3D1C31), muted = Color(0xFF8A5A6E);
const pink = Color(0xFFFF5577), violet = Color(0xFFC93DFF);
const line = Color(0xFFECD9E0), line2 = Color(0xFFE3CBD4), line3 = Color(0xFFF0E4E8);
const tint = Color(0xFFFAF6FA), pinkTint = Color(0xFFFFEEF2), pinkText = Color(0xFFC2185B);
const okFg = Color(0xFF16704A), okBg = Color(0xFFE4F4EC);
const errFg = Color(0xFFB42318), errBg = Color(0xFFFDECEA), errLine = Color(0xFFF5C9C4), errText = Color(0xFF8A1C12);
const warnBg = Color(0xFFFFF1DC), warnFg = Color(0xFF8A4B00), warnText = Color(0xFF4A2800);
final scrim = ink2.withValues(alpha: .42);

const brandGradient = LinearGradient(colors: [pink, violet]); // left to right (90 deg)
const softGradient = LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFFFFEEF2), Color(0xFFFCE8F5), Color(0xFFF1E6FF)]);

// Geist for Latin (a variable font: the weight is its "wght" axis), IBM Plex Sans Arabic as the fallback for Arabic letters.
// [ls] is letter spacing in em (the design uses -0.02 for headings).
TextStyle ts(double size, {int w = 500, Color color = ink, double ls = 0, double? h, bool tabular = false, bool italic = false}) => TextStyle(
      fontFamily: 'Geist', fontFamilyFallback: const ['IBMPlexSansArabic'], fontSize: size, color: color, height: h, letterSpacing: size * ls,
      fontWeight: FontWeight.values[((w ~/ 100) - 1).clamp(0, 8)], fontVariations: [FontVariation('wght', w.toDouble())],
      fontFeatures: tabular ? const [FontFeature.tabularFigures()] : null, fontStyle: italic ? FontStyle.italic : FontStyle.normal, decoration: TextDecoration.none);

ThemeData appTheme() => ThemeData(
      useMaterial3: true, fontFamily: 'Geist', colorScheme: ColorScheme.fromSeed(seedColor: pink, primary: pink, surface: Colors.white),
      scaffoldBackgroundColor: tint, canvasColor: Colors.white, splashFactory: InkRipple.splashFactory,
      textTheme: Typography.blackMountainView.apply(bodyColor: ink, displayColor: ink, fontFamily: 'Geist'),
    );
