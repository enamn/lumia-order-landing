import 'package:flutter/material.dart';

const brand = Color(0xFFFF5577), brandDeep = Color(0xFF8A2040), ink = Color(0xFF2A1020), purple = Color(0xFFC93DFF);

ThemeData appTheme() => ThemeData(
      useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: brand, primary: brandDeep, surface: Colors.white),
      scaffoldBackgroundColor: const Color(0xFFFBF6F8), textTheme: Typography.blackMountainView.apply(bodyColor: ink, displayColor: ink),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)))),
      outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(52), textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)))),
    );
