import 'package:flutter/material.dart';
import 'icons.dart';
import 'theme.dart';

// "Lumia" over "Order": the wordmark next to the mark. Always left-to-right.
class Wordmark extends StatelessWidget {
  const Wordmark({super.key, this.lumia = 26, this.order = 22});
  final double lumia, order;
  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: TextDirection.ltr,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          Text('Lumia', style: ts(lumia, w: 700, ls: -0.035, h: .95)),
          Text('Order', style: ts(order, w: 400, ls: -0.02, h: .95)),
        ]),
      );
}

class LogoLockup extends StatelessWidget {
  const LogoLockup({super.key, this.mark = 64, this.lumia = 26, this.order = 22, this.gap = 12});
  final double mark, lumia, order, gap;
  @override
  Widget build(BuildContext context) => Directionality(
        textDirection: TextDirection.ltr,
        child: Row(mainAxisSize: MainAxisSize.min, children: [LumiaMark(size: mark), SizedBox(width: gap), Wordmark(lumia: lumia, order: order)]),
      );
}

// The primary action: the brand gradient. Disabled (while busy) it fades.
class GradButton extends StatelessWidget {
  const GradButton({super.key, required this.label, required this.onTap, this.height = 64, this.size = 19, this.icon, this.glow = false, this.busy = false});
  final String label;
  final VoidCallback? onTap;
  final double height, size;
  final String? icon;
  final bool glow, busy;
  @override
  Widget build(BuildContext context) => Opacity(
        opacity: onTap == null && !busy ? .5 : 1,
        child: Material(
          color: Colors.transparent,
          child: Ink(
            height: height,
            decoration: BoxDecoration(gradient: brandGradient, borderRadius: BorderRadius.circular(12), boxShadow: glow ? [BoxShadow(color: violet.withValues(alpha: .7), blurRadius: 22, offset: const Offset(0, 10), spreadRadius: -12)] : null),
            child: InkWell(
              borderRadius: BorderRadius.circular(12), onTap: busy ? null : onTap,
              child: Center(
                child: busy
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 3, color: Colors.white))
                    : Row(mainAxisSize: MainAxisSize.min, children: [
                        if (icon != null) ...[Ic(icon!, size: 24, color: Colors.white, stroke: 1.7), const SizedBox(width: 10)],
                        Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(size, w: 600, color: Colors.white))),
                      ]),
              ),
            ),
          ),
        ),
      );
}

class OutButton extends StatelessWidget {
  const OutButton({super.key, required this.label, required this.onTap, this.height = 56, this.size = 17, this.border = line2, this.color = ink, this.fill, this.icon, this.padH = 0});
  final String label;
  final VoidCallback? onTap;
  final double height, size, padH;
  final Color border, color;
  final Color? fill;
  final String? icon;
  @override
  Widget build(BuildContext context) => Material(
        color: Colors.transparent,
        child: Ink(
          height: height, decoration: BoxDecoration(color: fill ?? Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: border, width: 1.5)),
          child: InkWell(
            borderRadius: BorderRadius.circular(12), onTap: onTap,
            child: Padding(padding: EdgeInsets.symmetric(horizontal: padH), child: Center(child: Row(mainAxisSize: MainAxisSize.min, children: [
              if (icon != null) ...[Ic(icon!, size: 22, color: color), const SizedBox(width: 8)],
              Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(size, w: 600, color: color))),
            ]))),
          ),
        ),
      );
}

// English | العربية: the selected side carries the gradient.
class LangSwitch extends StatelessWidget {
  const LangSwitch({super.key, required this.lang, required this.onChanged, this.padH = 16});
  final String lang;
  final ValueChanged<String> onChanged;
  final double padH;
  @override
  Widget build(BuildContext context) => Container(
        height: 48, padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(color: tint, borderRadius: BorderRadius.circular(999), border: Border.all(color: line3)),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            for (final o in const [('en', 'English'), ('ar', 'العربية')])
              GestureDetector(
                onTap: () => onChanged(o.$1), behavior: HitTestBehavior.opaque,
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: padH), alignment: Alignment.center,
                  decoration: BoxDecoration(gradient: lang == o.$1 ? brandGradient : null, borderRadius: BorderRadius.circular(999)),
                  child: Text(o.$2, style: ts(15, w: 600, color: lang == o.$1 ? Colors.white : ink2)),
                ),
              ),
          ]),
        ),
      );
}

class GradSwitch extends StatelessWidget {
  const GradSwitch({super.key, required this.on, required this.onChanged});
  final bool on;
  final ValueChanged<bool> onChanged;
  @override
  Widget build(BuildContext context) => GestureDetector(
        onTap: () => onChanged(!on), behavior: HitTestBehavior.opaque,
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150), width: 56, height: 32, padding: const EdgeInsets.all(3), alignment: on ? Alignment.centerRight : Alignment.centerLeft,
            decoration: BoxDecoration(gradient: on ? brandGradient : null, color: on ? null : line2, borderRadius: BorderRadius.circular(999)),
            child: Container(width: 26, height: 26, decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle)),
          ),
        ),
      );
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label, required this.bg, required this.fg, this.height = 30, this.size = 14});
  final String label;
  final Color bg, fg;
  final double height, size;
  @override
  Widget build(BuildContext context) => Container(height: height, padding: const EdgeInsets.symmetric(horizontal: 12), alignment: Alignment.center, decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)), child: Text(label, style: ts(size, w: 600, color: fg)));
}

// A white card with a soft line, as on the order list and detail screens.
class LineCard extends StatelessWidget {
  const LineCard({super.key, required this.child, this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 14), this.onTap});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Material(
        color: Colors.transparent,
        child: Ink(
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: line3)),
          child: InkWell(borderRadius: BorderRadius.circular(14), onTap: onTap, child: Padding(padding: padding, child: child)),
        ),
      );
}

// A bottom sheet in the design's style: rounded top, a grip, 16 dp sides, 24 dp bottom.
Future<T?> showLumiaSheet<T>(BuildContext context, {required bool rtl, required WidgetBuilder builder}) => showModalBottomSheet<T>(
      context: context, isScrollControlled: true, backgroundColor: Colors.white, barrierColor: scrim, useSafeArea: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Directionality(
        textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
        child: SafeArea(top: false, child: Padding(padding: EdgeInsets.fromLTRB(16, 10, 16, 24 + MediaQuery.of(ctx).viewInsets.bottom), child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: line2, borderRadius: BorderRadius.circular(2)))),
          builder(ctx),
        ])))),
      ),
    );

// The centred card used for "already handled" and "disconnect?".
Future<T?> showLumiaDialog<T>(BuildContext context, {required bool rtl, required WidgetBuilder builder, double scrimAlpha = .42}) => showDialog<T>(
      context: context, barrierColor: ink2.withValues(alpha: scrimAlpha),
      builder: (ctx) => Directionality(
        textDirection: rtl ? TextDirection.rtl : TextDirection.ltr,
        child: Dialog(
          insetPadding: const EdgeInsets.all(24), backgroundColor: Colors.white, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(padding: const EdgeInsets.fromLTRB(20, 24, 20, 20), child: builder(ctx)),
        ),
      ),
    );
