"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  modelagemSchema,
  ModelagemFormValues,
  ORIGENS_CONTATO,
} from "@/lib/impressao-3d-schema";
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

const FormularioModelagem = () => {
  const form = useForm<ModelagemFormValues>({
    resolver: zodResolver(modelagemSchema),
    defaultValues: {
      nome: "",
      email: "",
      telefone: "",
      descricao: "",
    },
  });

  async function onSubmit(data: ModelagemFormValues) {
    // TODO: integrar com backend / EmailJS. Por enquanto o fluxo é só front.
    console.log("[modelagem] pedido de modelagem 3D:", data);
    toast.success("Recebemos seu pedido!", {
      description: "A equipe TITANS entra em contato pelo e-mail ou telefone informado.",
    });
    form.reset();
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
                  <Input type="email" placeholder="voce@email.com" {...field} />
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
                  <Input placeholder="(61) 90000-0000" {...field} />
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
          name="descricao"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descreva o que você precisa</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder="Conte o que é a peça, para que serve, medidas aproximadas, referências, prazo desejado..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full sm:w-auto">
          Enviar pedido de modelagem
        </Button>
      </form>
    </Form>
  );
};

export default FormularioModelagem;
