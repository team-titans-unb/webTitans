"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { FileUp, ImageUp, X } from "lucide-react";
import {
  arquivosSchema,
  ArquivosFormValues,
  ORIGENS_CONTATO,
} from "@/lib/impressao-3d-schema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODELOS_ACEITOS = ".stl,.step,.stp";
const FOTOS_ACEITAS = "image/*";

const FormularioArquivos = () => {
  const [modelos, setModelos] = useState<File[]>([]);
  const [fotos, setFotos] = useState<File[]>([]);
  const [erroArquivos, setErroArquivos] = useState<string | null>(null);
  const modelosRef = useRef<HTMLInputElement>(null);
  const fotosRef = useRef<HTMLInputElement>(null);

  const form = useForm<ArquivosFormValues>({
    resolver: zodResolver(arquivosSchema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      qualidade: "",
      observacoes: "",
    },
  });

  function adicionar(
    lista: File[],
    setLista: (f: File[]) => void,
    novos: FileList | null,
  ) {
    if (!novos) return;
    setErroArquivos(null);
    const combinados = [...lista];
    Array.from(novos).forEach((file) => {
      if (!combinados.some((f) => f.name === file.name && f.size === file.size)) {
        combinados.push(file);
      }
    });
    setLista(combinados);
  }

  function remover(
    lista: File[],
    setLista: (f: File[]) => void,
    index: number,
  ) {
    setLista(lista.filter((_, i) => i !== index));
  }

  async function onSubmit(data: ArquivosFormValues) {
    if (modelos.length === 0) {
      setErroArquivos("Anexe pelo menos um arquivo .stl ou .step.");
      return;
    }
    if (fotos.length === 0) {
      setErroArquivos("Anexe pelo menos uma foto de referência da peça.");
      return;
    }

    // TODO: integrar com backend / upload. Por enquanto o fluxo é só front.
    console.log("[arquivos] pedido com arquivos prontos:", {
      ...data,
      qualidade: data.qualidade || "padrão (1,75 mm)",
      modelos: modelos.map((f) => f.name),
      fotos: fotos.map((f) => f.name),
    });

    toast.success("Arquivos recebidos!", {
      description: "A equipe TITANS analisa os modelos e entra em contato com você.",
    });
    form.reset();
    setModelos([]);
    setFotos([]);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Seu nome completo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@gmail.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input placeholder="(DDD) 90000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="origem"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Por onde nos conheceu?</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma opção" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ORIGENS_CONTATO.map((origem) => (
                      <SelectItem key={origem} value={origem}>
                        {origem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="qualidade"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Qualidade da impressão</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex.: padrão, alta precisão, 1,75 mm..."
                  {...field}
                />
              </FormControl>
              <p className="text-xs text-muted-foreground">
                1,75&nbsp;mm é a qualidade padrão e o resultado da peça já fica
                satisfatório. Um nível maior de precisão acarreta em maior tempo
                de impressão e, consequentemente, maior valor.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-6 sm:grid-cols-2">
          <AnexoCampo
            titulo="Arquivos do modelo"
            ajuda="Aceitamos .stl e .step"
            icone={<FileUp className="h-5 w-5" />}
            accept={MODELOS_ACEITOS}
            inputRef={modelosRef}
            arquivos={modelos}
            onAdd={(files) => adicionar(modelos, setModelos, files)}
            onRemove={(i) => remover(modelos, setModelos, i)}
          />

          <AnexoCampo
            titulo="Foto da peça / referência"
            ajuda="JPG ou PNG"
            icone={<ImageUp className="h-5 w-5" />}
            accept={FOTOS_ACEITAS}
            inputRef={fotosRef}
            arquivos={fotos}
            onAdd={(files) => adicionar(fotos, setFotos, files)}
            onRemove={(i) => remover(fotos, setFotos, i)}
          />
        </div>

        {erroArquivos && (
          <p className="text-sm font-medium text-destructive">{erroArquivos}</p>
        )}

        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações (opcional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Material desejado, cor, quantidade, prazo, detalhes de acabamento..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Enviar arquivos
        </Button>
      </form>
    </Form>
  );
};

type AnexoCampoProps = {
  titulo: string;
  ajuda: string;
  icone: React.ReactNode;
  accept: string;
  inputRef: React.RefObject<HTMLInputElement>;
  arquivos: File[];
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
};

const AnexoCampo = ({
  titulo,
  ajuda,
  icone,
  accept,
  inputRef,
  arquivos,
  onAdd,
  onRemove,
}: AnexoCampoProps) => (
  <div className="space-y-3">
    <p className="text-sm font-medium">{titulo}</p>
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input",
        "bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:bg-muted/60",
      )}
    >
      {icone}
      <span>
        Clique para selecionar
        <br />
        <span className="text-xs">{ajuda}</span>
      </span>
    </button>
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple
      className="hidden"
      onChange={(e) => {
        onAdd(e.target.files);
        e.target.value = "";
      }}
    />

    {arquivos.length > 0 && (
      <ul className="space-y-1">
        {arquivos.map((file, i) => (
          <li
            key={`${file.name}-${file.size}`}
            className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs"
          >
            <span className="truncate">{file.name}</span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={`Remover ${file.name}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export default FormularioArquivos;
