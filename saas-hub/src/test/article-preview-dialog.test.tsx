import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ArticlePreviewDialog } from "@/components/ArticlePreviewDialog";
import type { ArticleRecord } from "@/lib/app-data";

const baseArticle: Partial<ArticleRecord> = {
  id: "test-1",
  title: "AI副業で稼ぐ方法",
  freeContent: "AIを使った副業の始め方を解説します。",
  paidContent: "具体的なステップを紹介します（有料）。",
  body: "AI副業の全文です。",
  saleMode: "paid",
};

const defaultProps = {
  open: true,
  article: baseArticle,
  action: "draft" as const,
  isRegenerating: false,
  onConfirm: vi.fn(),
  onRegenerate: vi.fn().mockResolvedValue(undefined),
  onClose: vi.fn(),
};

describe("ArticlePreviewDialog", () => {
  it("open=true のときダイアログが表示される", () => {
    render(<ArticlePreviewDialog {...defaultProps} />);
    expect(screen.getByText("生成プレビュー")).toBeInTheDocument();
  });

  it("open=false のときダイアログが非表示", () => {
    render(<ArticlePreviewDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("生成プレビュー")).not.toBeInTheDocument();
  });

  it("タイトルが表示される", () => {
    render(<ArticlePreviewDialog {...defaultProps} />);
    expect(screen.getByText("AI副業で稼ぐ方法")).toBeInTheDocument();
  });

  it("タイトルが空のとき「（タイトルなし）」が表示される", () => {
    render(
      <ArticlePreviewDialog
        {...defaultProps}
        article={{ ...baseArticle, title: "" }}
      />
    );
    expect(screen.getByText("（タイトルなし）")).toBeInTheDocument();
  });

  it("無料パートが表示される", () => {
    render(<ArticlePreviewDialog {...defaultProps} />);
    expect(screen.getByText("AIを使った副業の始め方を解説します。")).toBeInTheDocument();
  });

  it("saleMode=paid のとき有料パートが表示される", () => {
    render(<ArticlePreviewDialog {...defaultProps} />);
    expect(screen.getByText("具体的なステップを紹介します（有料）。")).toBeInTheDocument();
    expect(screen.getByText("有料パート")).toBeInTheDocument();
  });

  it("saleMode=free のとき有料パートは表示されない", () => {
    render(
      <ArticlePreviewDialog
        {...defaultProps}
        article={{ ...baseArticle, saleMode: "free", paidContent: "" }}
      />
    );
    expect(screen.queryByText("有料パート")).not.toBeInTheDocument();
  });

  it("paidContent が空のとき有料パートは表示されない", () => {
    render(
      <ArticlePreviewDialog
        {...defaultProps}
        article={{ ...baseArticle, paidContent: "" }}
      />
    );
    expect(screen.queryByText("有料パート")).not.toBeInTheDocument();
  });

  it("「プレビュー完了」ボタンクリックで onConfirm が呼ばれる", async () => {
    const onConfirm = vi.fn();
    render(<ArticlePreviewDialog {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByTestId("confirm-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("action=draft のとき「下書き保存」ラベルが表示される", () => {
    render(<ArticlePreviewDialog {...defaultProps} action="draft" />);
    expect(screen.getByTestId("confirm-button")).toHaveTextContent("下書き保存");
  });

  it("action=publish のとき「公開する」ラベルが表示される", () => {
    render(<ArticlePreviewDialog {...defaultProps} action="publish" />);
    expect(screen.getByTestId("confirm-button")).toHaveTextContent("公開する");
  });

  it("action=schedule のとき「予約投稿に設定」ラベルが表示される", () => {
    render(<ArticlePreviewDialog {...defaultProps} action="schedule" />);
    expect(screen.getByTestId("confirm-button")).toHaveTextContent("予約投稿に設定");
  });

  it("再生成ボタンクリックで onRegenerate が呼ばれる（追加プロンプトなし）", async () => {
    const onRegenerate = vi.fn().mockResolvedValue(undefined);
    render(<ArticlePreviewDialog {...defaultProps} onRegenerate={onRegenerate} />);
    await userEvent.click(screen.getByTestId("regenerate-button"));
    expect(onRegenerate).toHaveBeenCalledWith("");
  });

  it("追加プロンプトを入力して再生成するとプロンプト内容が渡される", async () => {
    const onRegenerate = vi.fn().mockResolvedValue(undefined);
    render(<ArticlePreviewDialog {...defaultProps} onRegenerate={onRegenerate} />);

    await userEvent.type(
      screen.getByTestId("additional-prompt"),
      "もっと具体的なステップを入れて"
    );
    await userEvent.click(screen.getByTestId("regenerate-button"));

    expect(onRegenerate).toHaveBeenCalledWith("もっと具体的なステップを入れて");
  });

  it("再生成後に追加プロンプト入力欄がクリアされる", async () => {
    const onRegenerate = vi.fn().mockResolvedValue(undefined);
    render(<ArticlePreviewDialog {...defaultProps} onRegenerate={onRegenerate} />);

    const textarea = screen.getByTestId("additional-prompt");
    await userEvent.type(textarea, "冒頭をキャッチーにして");
    await userEvent.click(screen.getByTestId("regenerate-button"));

    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  it("isRegenerating=true のときボタンがすべて disabled になる", () => {
    render(<ArticlePreviewDialog {...defaultProps} isRegenerating={true} />);
    expect(screen.getByTestId("regenerate-button")).toBeDisabled();
    expect(screen.getByTestId("confirm-button")).toBeDisabled();
  });

  it("isRegenerating=true のとき追加プロンプト入力欄が disabled になる", () => {
    render(<ArticlePreviewDialog {...defaultProps} isRegenerating={true} />);
    expect(screen.getByTestId("additional-prompt")).toBeDisabled();
  });

  it("isRegenerating=true のとき再生成ボタンが「再生成中...」になる", () => {
    render(<ArticlePreviewDialog {...defaultProps} isRegenerating={true} />);
    expect(screen.getByTestId("regenerate-button")).toHaveTextContent("再生成中...");
  });

  it("freeContent がなく body がある場合 body が表示される", () => {
    render(
      <ArticlePreviewDialog
        {...defaultProps}
        article={{ ...baseArticle, freeContent: "", body: "全文テキストです。" }}
      />
    );
    expect(screen.getByText("全文テキストです。")).toBeInTheDocument();
  });

  it("freeContent も body もない場合「（内容なし）」が表示される", () => {
    render(
      <ArticlePreviewDialog
        {...defaultProps}
        article={{ ...baseArticle, freeContent: "", body: "" }}
      />
    );
    expect(screen.getByText("（内容なし）")).toBeInTheDocument();
  });

  it("isRegenerating=false のとき onClose を呼べる（Dialogを閉じる）", () => {
    const onClose = vi.fn();
    render(<ArticlePreviewDialog {...defaultProps} onClose={onClose} />);
    // Radix Dialog の onOpenChange を false で発火させる（escape キー）
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    // Radix UI Dialog は Escape でonOpenChange(false)を呼ぶので onClose が呼ばれる
    expect(onClose).toHaveBeenCalled();
  });
});

describe("編集モード（TC-DLG-03/04/05/07/09）", () => {
  it("TC-DLG-03: edit-toggle クリック → テキストエリア表示", async () => {
    render(<ArticlePreviewDialog {...defaultProps} />);
    await userEvent.click(screen.getByTestId("edit-toggle"));
    expect(screen.getByTestId("edit-title")).toBeInTheDocument();
    expect(screen.getByTestId("edit-free-content")).toBeInTheDocument();
  });

  it("TC-DLG-04: 編集適用（edit-toggle 再クリック） → onEdit 呼ばれること", async () => {
    const onEdit = vi.fn();
    render(<ArticlePreviewDialog {...defaultProps} onEdit={onEdit} />);
    // 1回目クリックで編集モードON
    await userEvent.click(screen.getByTestId("edit-toggle"));
    // 2回目クリックで編集適用 → onEdit が呼ばれる
    await userEvent.click(screen.getByTestId("edit-toggle"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("TC-DLG-05: isRegenerating=true → edit-toggle も disabled になること", () => {
    render(<ArticlePreviewDialog {...defaultProps} isRegenerating={true} />);
    expect(screen.getByTestId("edit-toggle")).toBeDisabled();
  });

  it("TC-DLG-07: isEditMode=true で再生成 → onEdit が先に呼ばれ、その後 onRegenerate", async () => {
    const onEdit = vi.fn();
    const onRegenerate = vi.fn().mockResolvedValue(undefined);
    render(<ArticlePreviewDialog {...defaultProps} onEdit={onEdit} onRegenerate={onRegenerate} />);
    // 編集モードON
    await userEvent.click(screen.getByTestId("edit-toggle"));
    // 再生成クリック
    await userEvent.click(screen.getByTestId("regenerate-button"));
    // 両方呼ばれていること
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("TC-DLG-09: isEditMode=true で confirm → onEdit と onConfirm が両方呼ばれること", async () => {
    const onEdit = vi.fn();
    const onConfirm = vi.fn();
    render(<ArticlePreviewDialog {...defaultProps} onEdit={onEdit} onConfirm={onConfirm} />);
    // 編集モードON
    await userEvent.click(screen.getByTestId("edit-toggle"));
    // 確認ボタンクリック
    await userEvent.click(screen.getByTestId("confirm-button"));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

it("TC-DLG-12: isRegenerating=true のとき ESC → onClose が呼ばれないこと", () => {
  const onClose = vi.fn();
  render(<ArticlePreviewDialog {...defaultProps} isRegenerating={true} onClose={onClose} />);
  fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
});
