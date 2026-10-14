import 'package:flutter/material.dart';
import 'icons.dart';
import 'strings.dart';
import 'theme.dart';

// The in-app splash: the mark fades in, the wordmark sits under it and a thin gradient bar fills (about 1.1 s). While the terminal is still
// reaching the internet it shows "Connecting..." with a looping bar instead. The mark is never mirrored in Arabic.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.lang, this.offline = false});
  final String lang;
  final bool offline;
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late final AnimationController _in = AnimationController(vsync: this, duration: const Duration(milliseconds: 260))..forward();
  late final AnimationController _bar = AnimationController(vsync: this, duration: const Duration(milliseconds: 1100))..forward();
  late final AnimationController _loop = AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..repeat();

  @override
  void dispose() { _in.dispose(); _bar.dispose(); _loop.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    final l = widget.lang;
    return Directionality(
      textDirection: l == 'ar' ? TextDirection.rtl : TextDirection.ltr,
      child: Scaffold(
        body: Container(
          decoration: const BoxDecoration(gradient: softGradient),
          child: SafeArea(
            child: Column(children: [
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 40),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    FadeTransition(opacity: _in, child: ScaleTransition(scale: Tween(begin: .92, end: 1.0).animate(_in), child: const LumiaMark(size: 120))),
                    const SizedBox(height: 20),
                    Directionality(textDirection: TextDirection.ltr, child: Column(children: [Text('Lumia', style: ts(36, w: 700, ls: -0.035, h: .95)), Text('Order', style: ts(30, w: 400, ls: -0.02, h: .95))])),
                    if (widget.offline)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(32, 24, 32, 0),
                        child: Column(children: [
                          Text(tr(l, 'connecting'), style: ts(18, w: 600), textAlign: TextAlign.center),
                          const SizedBox(height: 6),
                          Text(tr(l, 'connectingBody'), style: ts(15, color: ink2, h: 1.45), textAlign: TextAlign.center),
                        ]),
                      ),
                  ]),
                ),
              ),
              Padding(padding: const EdgeInsets.only(bottom: 48), child: _bar0()),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _bar0() => Container(
        width: 140, height: 4, clipBehavior: Clip.antiAlias, decoration: BoxDecoration(color: brandDeepTrack, borderRadius: BorderRadius.circular(2)),
        child: widget.offline
            ? AnimatedBuilder(animation: _loop, builder: (_, _) => Align(alignment: Alignment(-1.1 + 3.2 * _loop.value, 0), child: FractionallySizedBox(widthFactor: .4, child: Container(decoration: BoxDecoration(gradient: brandGradient, borderRadius: BorderRadius.circular(2))))))
            : AnimatedBuilder(animation: _bar, builder: (_, _) => Align(alignment: AlignmentDirectional.centerStart, child: FractionallySizedBox(widthFactor: Curves.easeOut.transform(_bar.value), child: Container(decoration: BoxDecoration(gradient: brandGradient, borderRadius: BorderRadius.circular(2)))))),
      );
}

// The track behind the bar: the maroon of the brand at 12%.
final brandDeepTrack = const Color(0xFF8A2040).withValues(alpha: .12);
