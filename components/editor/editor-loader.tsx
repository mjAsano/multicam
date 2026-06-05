import dynamic from "next/dynamic";

const MulticamEditor = dynamic(() => import("./multicam-editor"), {
  loading: () => <div className="editor-loading">편집 워크스페이스 로딩 중...</div>
});

export default function EditorLoader() {
  return <MulticamEditor />;
}
