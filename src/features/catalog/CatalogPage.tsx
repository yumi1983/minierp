import { Tag } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { CategoryTab } from './components/CategoryTab'
import { BrandTab } from './components/BrandTab'
import { UnitTab } from './components/UnitTab'

export function CatalogPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Tag className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Catálogo</h2>
          <p className="text-sm text-muted-foreground">
            Categorías, marcas y unidades de medida
          </p>
        </div>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categorías</TabsTrigger>
          <TabsTrigger value="brands">Marcas</TabsTrigger>
          <TabsTrigger value="units">Unidades</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <CategoryTab />
        </TabsContent>
        <TabsContent value="brands">
          <BrandTab />
        </TabsContent>
        <TabsContent value="units">
          <UnitTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
