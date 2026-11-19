import SwiftUI
import WebKit

/// Yappu 空乘 · 非正式商用版
/// 设计者：Chao Wang（Bellary）
/// 把已构建好的网页版（航空乘务词库）装进 WKWebView。
@main
struct YappuApp: App {
    var body: some Scene {
        WindowGroup {
            WebContainer()
                .ignoresSafeArea()
                .background(Color.white)
        }
    }
}

struct WebContainer: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.backgroundColor = .white
        webView.isOpaque = false
        webView.allowsBackForwardNavigationGestures = false

        if let dir = Bundle.main.url(forResource: "web", withExtension: nil),
           let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            webView.loadFileURL(index, allowingReadAccessTo: dir)
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
