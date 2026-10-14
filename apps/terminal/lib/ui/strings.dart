// Interface text in English and Arabic (the wording of the design "Lumia Order Terminal App").
const _t = <String, List<String>>{
  // connect
  'connectTitle': ['Connect this terminal', 'اربط هذا الجهاز'],
  'connectSub': ['On your Lumia Order dashboard, open Settings, then Devices, and tap Connect a device.', 'من لوحة تحكم Lumia Order افتح الإعدادات، ثم الأجهزة، واضغط ربط جهاز.'],
  'scan': ['Scan QR code', 'امسح رمز QR'],
  'orCode': ['Or enter the 6-digit code', 'أو أدخل الرمز المكوّن من 6 أرقام'],
  'connect': ['Connect', 'ربط'],
  'codeErr': ['Code wrong or expired. Get a new one from the dashboard.', 'الرمز غير صحيح أو منتهي الصلاحية. احصل على رمز جديد من لوحة التحكم.'],
  'inUse': ['This terminal is connected to another restaurant.', 'هذا الجهاز متصل بمطعم آخر.'],
  'tooMany': ['Too many tries. Wait a few minutes.', 'محاولات كثيرة. انتظر قليلاً.'],
  'sixDigits': ['Enter the 6-digit code.', 'أدخل الرمز المكوّن من 6 أرقام.'],
  'cancel': ['Cancel', 'إلغاء'],
  // splash
  'connecting': ['Connecting...', 'جارٍ الاتصال...'],
  'connectingBody': ['Check the Wi-Fi or SIM. Orders arrive as soon as the terminal is online.', 'تحقق من الواي فاي أو الشريحة. تصل الطلبات فور اتصال الجهاز.'],
  // orders list
  'online': ['Online', 'متصل'],
  'offline': ['Offline', 'غير متصل'],
  'new': ['New', 'جديد'],
  'preparing': ['Preparing', 'قيد التحضير'],
  'ready': ['Ready', 'جاهز'],
  'out': ['On the way', 'في الطريق'],
  'done': ['Done', 'مكتمل'],
  'rejected': ['Rejected', 'مرفوض'],
  'emptyTitle_new': ['No new orders', 'لا توجد طلبات جديدة'],
  'emptyBody_new': ['New WhatsApp orders ring here.', 'تظهر هنا طلبات واتساب الجديدة مع تنبيه.'],
  'emptyTitle_preparing': ['Nothing in the kitchen', 'لا شيء قيد التحضير'],
  'emptyBody_preparing': ['Accepted orders appear here while they are prepared.', 'تظهر هنا الطلبات المقبولة أثناء تحضيرها.'],
  'emptyTitle_ready': ['No orders ready', 'لا توجد طلبات جاهزة'],
  'emptyBody_ready': ['Orders you mark as ready show up here.', 'تظهر هنا الطلبات التي تحددها كجاهزة.'],
  'emptyTitle_out': ['No orders on the way', 'لا توجد طلبات في الطريق'],
  'emptyBody_out': ['Orders sent out for delivery appear here.', 'تظهر هنا الطلبات التي خرجت للتوصيل.'],
  'emptyTitle_done': ['No finished orders yet', 'لا توجد طلبات منتهية بعد'],
  'emptyBody_done': ['Completed and rejected orders appear here.', 'تظهر هنا الطلبات المكتملة والمرفوضة.'],
  'offTitle': ['You are offline', 'أنت غير متصل'],
  'offBody': ['New orders will ring as soon as the connection is back.', 'سيرنّ الجهاز للطلبات الجديدة فور عودة الاتصال.'],
  'retry': ['Retry', 'إعادة المحاولة'],
  'readyByShort': ['Ready by', 'جاهز قبل'],
  'delivery': ['Delivery', 'توصيل'],
  'pickup': ['Pickup', 'استلام'],
  'dineIn': ['Dine in', 'في المطعم'],
  'now': ['now', 'الآن'],
  // alert
  'newOrder': ['New order', 'طلب جديد'],
  'waiting': ['waiting', 'بانتظارك'],
  'confirmedWA': ['Customer confirmed on WhatsApp', 'أكّد العميل الطلب على واتساب'],
  'noteLabel': ['Customer note', 'ملاحظة العميل'],
  'deliverTo': ['Deliver to', 'التوصيل إلى'],
  'customer': ['Customer', 'العميل'],
  'reject': ['Reject', 'رفض'],
  'accept': ['Accept', 'قبول'],
  // sheets
  'readyIn': ['Ready in', 'جاهز خلال'],
  'deliveryIn': ['Delivery in', 'التوصيل خلال'],
  'min': ['min', 'دقيقة'],
  'arrivesBy': ['Arrives by', 'يصل قبل'],
  'readyBy': ['Ready by', 'جاهز قبل'],
  'acceptOrder': ['Accept order', 'قبول الطلب'],
  'rejTitle': ['Why are you rejecting?', 'لماذا ترفض الطلب؟'],
  'rejSub': ['{name} gets this reason on WhatsApp.', 'سيصل هذا السبب إلى {name} على واتساب.'],
  'r1': ['Sold out', 'نفدت الكمية'],
  'r2': ['Too busy', 'مشغول جداً'],
  'r3': ['Closing soon', 'سنغلق قريباً'],
  'r4': ['Outside delivery area', 'خارج منطقة التوصيل'],
  'keep': ['Keep order', 'الإبقاء على الطلب'],
  // detail
  'orderTitle': ['Order', 'الطلب'],
  'acceptedAt': ['Accepted {t} · {type}', 'تم القبول {t} · {type}'],
  'itemsLabel': ['Items', 'الأصناف'],
  'subtotal': ['Subtotal', 'المجموع الفرعي'],
  'discount': ['Discount', 'الخصم'],
  'fee': ['Delivery fee', 'رسوم التوصيل'],
  'total': ['Total', 'الإجمالي'],
  'print': ['Print', 'طباعة'],
  'markReady': ['Mark ready', 'تحديد كجاهز'],
  'sendOut': ['Out for delivery', 'خرج للتوصيل'],
  'complete': ['Completed', 'تم التسليم'],
  'printing': ['Printing receipt...', 'جارٍ طباعة الإيصال...'],
  'printFail': ['Could not print', 'تعذّرت الطباعة'],
  'printFailBody': ['Check the paper, then tap to retry.', 'تحقق من الورق ثم اضغط لإعادة المحاولة.'],
  'handledTitle': ['Already handled', 'تمت معالجة الطلب'],
  'handledBody': ['Order #{n} was already updated on the dashboard. Nothing more to do here.', 'تم تحديث الطلب #{n} من لوحة التحكم. لا حاجة لأي إجراء هنا.'],
  'ok': ['OK', 'حسناً'],
  // settings
  'setTitle': ['Settings', 'الإعدادات'],
  'alarm': ['Alarm sound', 'صوت التنبيه'],
  'alarmOn': ['Chime, loud', 'جرس، مرتفع'],
  'alarmOff': ['Off', 'مغلق'],
  'printOnAccept': ['Print on accept', 'الطباعة عند القبول'],
  'language': ['Language', 'اللغة'],
  'terminal': ['This terminal', 'هذا الجهاز'],
  'disconnect': ['Disconnect this terminal', 'فصل هذا الجهاز'],
  'dcTitle': ['Disconnect this terminal?', 'فصل هذا الجهاز؟'],
  'dcBody': ['It stops receiving orders until you connect it again with a new code.', 'سيتوقف عن استقبال الطلبات حتى تربطه مجدداً برمز جديد.'],
  'dcBtn': ['Disconnect', 'فصل'],
};

String tr(String lang, String key) => (_t[key] ?? [key, key])[lang == 'ar' ? 1 : 0];
String trv(String lang, String key, Map<String, String> vars) => vars.entries.fold(tr(lang, key), (s, e) => s.replaceAll('{${e.key}}', e.value));

// "7:42 pm" / "7:42 م"
String clock(String lang, DateTime t) {
  final h = t.hour % 12 == 0 ? 12 : t.hour % 12, m = t.minute.toString().padLeft(2, '0');
  return '$h:$m ${t.hour < 12 ? (lang == 'ar' ? 'ص' : 'am') : (lang == 'ar' ? 'م' : 'pm')}';
}

// "4 min ago" / "منذ 4 دقائق"
String agoText(String lang, int minutes) {
  if (minutes < 1) return lang == 'ar' ? 'الآن' : 'just now';
  if (lang != 'ar') return '$minutes min ago';
  if (minutes == 1) return 'منذ دقيقة';
  if (minutes == 2) return 'منذ دقيقتين';
  return 'منذ $minutes ${minutes <= 10 ? 'دقائق' : 'دقيقة'}';
}
